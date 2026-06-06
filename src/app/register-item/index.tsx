import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
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
  const { user } = useAuthStore();
  const { itemsCount, fetchCount } = useItemStore();
  const { tier } = useSubscriptionStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Personal');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [tagType, setTagType] = useState<TagType>('nfc_only');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState({ tier: 'pro', feature: '' });

  useEffect(() => {
    if (user?.id) fetchCount(user.id);
  }, [user]);

  const limitReached = itemsCount >= PLAN_LIMITS[tier].maxItems;

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
      // Upload to Supabase storage in background
      if (asset.base64 && user?.id) {
        const ext = asset.uri.split('.').pop() || 'jpg';
        const path = `items/${user.id}/${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage
          .from('item-images')
          .upload(path, decode(asset.base64), {
            contentType: `image/${ext}`,
            upsert: true,
          });
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

      const { data, error } = await supabase.from('items').insert({
        user_id: user?.id,
        item_name: name,
        category,
        color,
        description,
        image_url: imageUri,
        nfc_uid,
        ble_beacon_id,
        tag_type: tagType,
        status: 'active',
        tracking_networks: tagType !== 'nfc_only' ? ['app_relay'] : [],
      }).select().single();

      if (error) throw error;

      // ── Capture GPS location at registration time ──────────────────────────
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
      } catch (locErr) {
        console.warn('Could not capture registration GPS:', locErr);
        // Non-fatal — item still created
      }

      // ── Generate multi-network keys for BLE items ──────────────────────
      if (tagType !== 'nfc_only' && data?.id) {
        try {
          // Layer 1: Google Find My Device Network (FMDN)
          const fmdnKeys = await generateFMDNKeyPair();
          await registerFMDNKeys(data.id, fmdnKeys);

          // Layer 2: Apple Find My (OpenHaystack)
          if (tier === 'max') {
            const ofhaKeys = await generateOpenHaystackKeyPair();
            await registerOpenHaystackKeys(data.id, ofhaKeys);
          }

          // Generate firmware config blob for the beacon
          await generateFirmwareConfig(data.id, 'esp32_c3');
        } catch (keyErr) {
          console.warn('Multi-network key generation warning:', keyErr);
          // Non-fatal — item is still created, keys can be regenerated later
        }
      }

      if (tagType === 'nfc_ble') {
        router.push({ pathname: '/nfc-ble-setup', params: { id: data.id, nfc_uid: nfc_uid || '', ble_beacon_id: ble_beacon_id || '' } });
      } else {
        router.push({
          pathname: '/register-item/write-tag',
          params: { id: data.id, nfc_uid: nfc_uid || '', ble_beacon_id: ble_beacon_id || '', tag_type: tagType },
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
      <View className="flex-1 justify-center p-6 bg-slate-50">
        <EntitlementGate requiredTier={rTier as any} featureName={rFeat}>
          <Text className="text-slate-900">Hidden</Text>
        </EntitlementGate>
        <TouchableOpacity className="mt-4" onPress={() => showUpgrade ? setShowUpgrade(false) : router.back()}>
          <Text className="text-center text-slate-500 font-bold p-4 text-lg">← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">My Items</Text>
        </TouchableOpacity>

        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">New Item</Text>
        <Text className="text-slate-900 text-3xl font-black mb-8">Register Item</Text>

        {/* Image Picker */}
        <TouchableOpacity
          onPress={pickImage}
          className="w-full h-44 bg-white border-2 border-dashed border-slate-300 rounded-3xl mb-6 items-center justify-center overflow-hidden shadow-sm"
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} className="w-full h-full" />
          ) : (
            <View className="items-center">
              <Text className="text-4xl mb-2">📷</Text>
              <Text className="text-slate-600 font-bold">Tap to add photo</Text>
              <Text className="text-slate-400 text-xs mt-1 font-medium">Optional but recommended</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Item Name */}
        <View className="mb-5">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Item Name *</Text>
          <View className="bg-white border border-slate-200 rounded-2xl px-4 flex-row items-center shadow-sm">
            <TextInput
              className="flex-1 text-slate-900 py-4 text-base font-medium"
              placeholder="e.g. Black Leather Wallet"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* Category */}
        <View className="mb-5">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold">Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-full border shadow-sm ${
                    category === cat
                      ? 'bg-primary/10 border-primary/20 shadow-primary/10'
                      : 'bg-white border-slate-200'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-bold text-sm ${category === cat ? 'text-primary' : 'text-slate-500'}`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Color */}
        <View className="mb-5">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Color</Text>
          <View className="bg-white border border-slate-200 rounded-2xl px-4 shadow-sm">
            <TextInput
              className="text-slate-900 py-4 text-base font-medium"
              placeholder="e.g. Black, Blue, Silver..."
              placeholderTextColor="#94a3b8"
              value={color}
              onChangeText={setColor}
            />
          </View>
        </View>

        {/* Description */}
        <View className="mb-6">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Description</Text>
          <View className="bg-white border border-slate-200 rounded-2xl px-4 shadow-sm">
            <TextInput
              className="text-slate-900 py-4 text-base font-medium"
              placeholder="Distinguishing features, damage, marks..."
              placeholderTextColor="#94a3b8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>
        </View>

        {/* Tag Type */}
        <TagTypeSelector
          selectedType={tagType}
          onSelect={setTagType}
          onLockedSelect={handleLockedSelect}
        />

        {/* Submit */}
        <TouchableOpacity
          className={`w-full bg-primary py-4 rounded-2xl items-center mt-6 shadow-md shadow-primary/30 ${loading ? 'opacity-60' : ''}`}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#ffffff" />
            : <Text className="text-white font-bold text-lg tracking-wide">Continue to Setup Tag →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
