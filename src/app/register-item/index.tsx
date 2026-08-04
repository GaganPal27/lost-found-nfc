import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, Alert, StatusBar, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import TagTypeSelector from '../../components/TagTypeSelector';
import EntitlementGate from '../../components/subscription/EntitlementGate';
import { PLAN_LIMITS } from '../../lib/constants';
import { generateFMDNKeyPair, registerFMDNKeys, generateFirmwareConfig } from '../../lib/fmdn';
import { generateOpenHaystackKeyPair, registerOpenHaystackKeys } from '../../lib/openhaystack';
import { generateServiceUUID } from '../../lib/ble';

type TagType = 'nfc_only' | 'nfc_ble' | 'ble_only';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const CATEGORIES = ['Personal', 'Electronics', 'Bag', 'Keys', 'Wallet', 'Travel', 'Other'];

export default function RegisterItemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { itemsCount, fetchCount } = useItemStore();
  const { tier } = useSubscriptionStore();

  const [name, setName]               = useState('');
  const [category, setCategory]       = useState('Personal');
  const [color, setColor]             = useState('');
  const [description, setDescription] = useState('');
  const [tagType, setTagType]         = useState<TagType>('nfc_only');
  const [imageUri, setImageUri]       = useState<string | null>(null);
  
  const [loading, setLoading]         = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState({ tier: 'pro', feature: '' });
  
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) fetchCount(user.id);
  }, [user]);

  const limitReached = itemsCount >= PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS].maxItems;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add an item photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      // Upload to Supabase in background
      if (asset.base64 && user?.id) {
        const ext = asset.uri.split('.').pop() || 'jpg';
        const path = `items/${user.id}/${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage
          .from('item-images')
          .upload(path, decode(asset.base64), { contentType: `image/${ext}`, upsert: true });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(data.path);
          if (urlData?.publicUrl) setImageUri(urlData.publicUrl);
        }
      }
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Item name is required');
    if (limitReached) return setShowUpgrade(true);

    try {
      setLoading(true);
      const nfc_uid = tagType !== 'ble_only' ? generateUUID() : null;
      const ble_beacon_id = tagType !== 'nfc_only' ? `LF-BLE-${generateUUID().slice(0, 6).toUpperCase()}` : null;
      const service_uuid = ble_beacon_id ? generateServiceUUID(ble_beacon_id) : null;

      const { data, error } = await supabase.from('items').insert({
        user_id: user?.id,
        item_name: name,
        category,
        color,
        description,
        image_url: imageUri,
        nfc_uid,
        ble_beacon_id,
        service_uuid,
        tag_type: tagType,
        status: 'active',
        tracking_networks: tagType !== 'nfc_only' ? ['app_relay'] : [],
      }).select().single();

      if (error) throw error;

      // Capture GPS location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await supabase.from('items').update({
            last_seen_lat: loc.coords.latitude,
            last_seen_lng: loc.coords.longitude,
            last_seen_at: new Date().toISOString(),
          }).eq('id', data.id);
        }
      } catch (locErr) { console.warn('Could not capture registration GPS:', locErr); }

      // Generate BLE keys
      if (tagType !== 'nfc_only' && data?.id) {
        try {
          const fmdnKeys = await generateFMDNKeyPair();
          await registerFMDNKeys(data.id, fmdnKeys);
          if (tier === 'max') {
            const ofhaKeys = await generateOpenHaystackKeyPair();
            await registerOpenHaystackKeys(data.id, ofhaKeys);
          }
          await generateFirmwareConfig(data.id, 'esp32_c3');
        } catch (keyErr) { console.warn('Multi-network key gen warning:', keyErr); }
      }

      if (tagType === 'nfc_ble') {
        router.push({ pathname: '/nfc-ble-setup', params: { id: data.id, nfc_uid: nfc_uid || '', ble_beacon_id: ble_beacon_id || '', service_uuid: service_uuid || '' } });
      } else {
        router.push({
          pathname: '/register-item/write-tag',
          params: { id: data.id, nfc_uid: nfc_uid || '', ble_beacon_id: ble_beacon_id || '', tag_type: tagType, service_uuid: service_uuid || '' },
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLockedSelect = (requiredTier: string) => {
    setUpgradeReason({ tier: requiredTier as 'pro' | 'max', feature: 'Premium Tag Types' });
    setShowUpgrade(true);
  };

  if (limitReached || showUpgrade) {
    const rTier = showUpgrade ? upgradeReason.tier : 'pro';
    const rFeat = showUpgrade ? upgradeReason.feature : 'Add more items';
    return (
      <View style={styles.entitlementWrap}>
        <EntitlementGate requiredTier={rTier as any} featureName={rFeat}>
          <Text style={{ display: 'none' }}>Hidden</Text>
        </EntitlementGate>
        <TouchableOpacity style={styles.entitlementBack} onPress={() => showUpgrade ? setShowUpgrade(false) : router.back()}>
          <Text style={styles.entitlementBackText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={['#6366f1', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.hCircle1} />
        <View style={styles.hCircle2} />

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerEyebrow}>New Item</Text>
        <Text style={styles.headerTitle}>Register Item</Text>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* Image Picker */}
          <TouchableOpacity
            onPress={pickImage}
            activeOpacity={0.8}
            style={styles.imagePicker}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imageFull} />
            ) : (
              <View style={styles.imageEmpty}>
                <Text style={styles.imageEmoji}>📷</Text>
                <Text style={styles.imageEmptyTitle}>Tap to add photo</Text>
                <Text style={styles.imageEmptySub}>Optional but recommended</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Item Name <Text style={{ color: '#e11d48' }}>*</Text></Text>
            <View style={[styles.inputRow, focusedField === 'name' && styles.inputRowFocused]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Black Leather Wallet"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {CATEGORIES.map(cat => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.7}
                    style={[styles.chip, isSelected ? styles.chipSelected : styles.chipDefault]}
                  >
                    <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : styles.chipTextDefault]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Color */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Color</Text>
            <View style={[styles.inputRow, focusedField === 'color' && styles.inputRowFocused]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Black, Blue, Silver..."
                placeholderTextColor="#94a3b8"
                value={color}
                onChangeText={setColor}
                onFocus={() => setFocusedField('color')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description</Text>
            <View style={[styles.inputRow, styles.inputRowMulti, focusedField === 'desc' && styles.inputRowFocused]}>
              <TextInput
                style={styles.inputMulti}
                placeholder="Distinguishing features, damage, marks..."
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onFocus={() => setFocusedField('desc')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Tag Type Selector */}
          <View style={styles.tagTypeWrap}>
            <TagTypeSelector
              selectedType={tagType}
              onSelect={setTagType}
              onLockedSelect={handleLockedSelect}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.88}
            style={styles.submitBtnWrap}
          >
            <LinearGradient
              colors={loading ? ['#94a3b8', '#94a3b8'] : ['#6366f1', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              {loading
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={styles.submitBtnText}>Continue to Setup Tag  →</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  entitlementWrap: { flex: 1, backgroundColor: '#f8faff', padding: 24, justifyContent: 'center' },
  entitlementBack: { marginTop: 16, padding: 16, alignItems: 'center' },
  entitlementBackText: { color: '#64748b', fontWeight: '700', fontSize: 16 },

  /* Header */
  header: {
    paddingHorizontal: 24,
    paddingBottom: 44,
    overflow: 'hidden',
    position: 'relative',
  },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -10, left: -40, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 12 },
  backBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },

  /* Body */
  body: {
    flex: 1,
    backgroundColor: '#f8faff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },

  /* Image Picker */
  imagePicker: {
    width: '100%',
    height: 160,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 24,
    marginBottom: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFull: { width: '100%', height: '100%' },
  imageEmpty: { alignItems: 'center' },
  imageEmoji: { fontSize: 40, marginBottom: 8 },
  imageEmptyTitle: { color: '#475569', fontWeight: '700', fontSize: 15 },
  imageEmptySub: { color: '#94a3b8', fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* Form Fields */
  fieldGroup: { marginBottom: 20 },
  label: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 },
  inputRow: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
  },
  inputRowFocused: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  input: { color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 14 },
  
  inputRowMulti: { paddingVertical: 12 },
  inputMulti: { color: '#0f172a', fontSize: 15, fontWeight: '500', minHeight: 80 },

  /* Categories */
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipDefault: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  chipSelected: { backgroundColor: '#eef2ff', borderColor: '#818cf8' },
  chipText: { fontSize: 13, fontWeight: '700' },
  chipTextDefault: { color: '#64748b' },
  chipTextSelected: { color: '#6366f1' },

  /* Tag Type */
  tagTypeWrap: { marginTop: 8, marginBottom: 24 },

  /* Submit Button */
  submitBtnWrap: { borderRadius: 18, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  submitBtn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
