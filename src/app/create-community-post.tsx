import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  Alert, StatusBar, StyleSheet, ActivityIndicator, ActionSheetIOS, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import * as Haptics from 'expo-haptics';

const CATEGORIES = ['Personal', 'Electronics', 'Bag', 'Keys', 'Wallet', 'Travel', 'Other'];

const CATEGORY_META: Record<string, { icon: string; bg: string }> = {
  Personal:    { icon: '👤', bg: '#E0E7FF' },
  Electronics: { icon: '💻', bg: '#FEF08A' },
  Bag:         { icon: '👜', bg: '#FCE7F3' },
  Keys:        { icon: '🔑', bg: '#DCFCE7' },
  Wallet:      { icon: '💳', bg: '#F3E8FF' },
  Travel:      { icon: '✈️', bg: '#FFE4E6' },
  Other:       { icon: '📦', bg: '#F3F4F6' },
};

export default function CreateCommunityPostScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [title, setTitle]               = useState('');
  const [category, setCategory]         = useState('Other');
  const [description, setDescription]   = useState('');
  const [proofQuestion, setProofQuestion] = useState('');
  const [imageUri, setImageUri]         = useState<string | null>(null);
  const [imageUrl, setImageUrl]         = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading]           = useState(false);

  // Resolved users.id (not auth.uid)
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    // Look up the custom users.id by matching auth_id = auth.uid()
    supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.id) setDbUserId(data.id);
      });
  }, [user]);

  // ── Image picker (camera + gallery) ─────────────────────────────────────────
  const pickImage = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        async (buttonIndex) => {
          if (buttonIndex === 1) await launchPicker('camera');
          if (buttonIndex === 2) await launchPicker('gallery');
        }
      );
    } else {
      // Android: simple Alert
      Alert.alert('Add Photo', 'Choose a source', [
        { text: 'Camera',  onPress: () => launchPicker('camera') },
        { text: 'Gallery', onPress: () => launchPicker('gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const launchPicker = async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take a photo.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to pick an image.');
        return;
      }
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.75, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.75, base64: true });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      await uploadImage(asset);
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64 || !user?.id) return;
    setUploadingImage(true);
    try {
      const ext  = asset.uri.split('.').pop() || 'jpg';
      const path = `community/${user.id}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('item-images')
        .upload(path, decode(asset.base64), { contentType: `image/${ext}`, upsert: true });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(data.path);
        if (urlData?.publicUrl) setImageUrl(urlData.publicUrl);
      }
    } catch (e) {
      console.warn('Image upload failed:', e);
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please give the item a title.');
      return;
    }
    if (!proofQuestion.trim()) {
      Alert.alert('Required', 'A proof question is required so the real owner can verify their claim.\n\ne.g. "What colour is the wallet?" or "What is the name on the ID?"');
      return;
    }
    if (!dbUserId) {
      Alert.alert('Error', 'Could not verify your account. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Grab GPS silently (non-blocking)
      let lat: number | null = null;
      let lng: number | null = null;
      let locationLabel: string | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          try {
            const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (place) {
              const parts = [place.name, place.district || place.subregion, place.city].filter(Boolean);
              locationLabel = parts.join(', ');
            }
          } catch (_) {}
        }
      } catch (_) {}

      const { data: insertedData, error } = await supabase.from('community_items').insert({
        finder_id:          dbUserId,
        title:              title.trim(),
        description:        description.trim() || null,
        category,
        location_found_lat: lat,
        location_found_lng: lng,
        location_label:     locationLabel,
        image_url:          imageUrl,
        status:             'open',
        proof_question:     proofQuestion.trim(),
      }).select().single();

      if (error) throw error;

      // Trigger Smart Match edge function in the background
      supabase.functions.invoke('smart-match', {
        body: { record: insertedData },
      }).catch(err => console.warn('Smart Match failed to run:', err));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '🎉 Posted!',
        'Your found item is now live on the Community Board. The real owner will be able to claim it.',
        [{ text: 'View Board', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not post item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const catMeta = CATEGORY_META[category] || CATEGORY_META.Other;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Community Board</Text>
        </TouchableOpacity>

        <Text style={styles.pageSuper}>Community Board</Text>
        <Text style={styles.pageTitle}>Post a Found Item</Text>
        <Text style={styles.pageHint}>Found something without a tag? Post it here so the owner can find it.</Text>

        {/* ── Photo picker ──────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={pickImage}
          style={styles.photoBox}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.photoImage} />
              {uploadingImage && (
                <View style={styles.photoOverlay}>
                  <ActivityIndicator color="#ffffff" />
                  <Text style={styles.photoOverlayText}>Uploading…</Text>
                </View>
              )}
              <View style={styles.changePhotoBadge}>
                <Text style={styles.changePhotoText}>📷 Change Photo</Text>
              </View>
            </>
          ) : (
            <View style={styles.photoPlaceholder}>
              <View style={[styles.photoIconBox, { backgroundColor: catMeta.bg }]}>
                <Text style={styles.photoIcon}>{catMeta.icon}</Text>
              </View>
              <Text style={styles.photoLabel}>Tap to add a photo</Text>
              <Text style={styles.photoHint}>Camera or gallery · Strongly recommended</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Black leather wallet found near metro"
              placeholderTextColor="#94a3b8"
              value={title}
              onChangeText={setTitle}
              autoCapitalize="sentences"
              maxLength={80}
            />
          </View>
        </View>

        {/* ── Category ──────────────────────────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pills}>
              {CATEGORIES.map(cat => {
                const m = CATEGORY_META[cat] || CATEGORY_META.Other;
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.pill, active ? { backgroundColor: m.bg, borderColor: 'rgba(99,102,241,0.2)' } : styles.pillInactive]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pillIcon}>{m.icon}</Text>
                    <Text style={[styles.pillText, active && { color: '#6366f1', fontWeight: '800' }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* ── Description ───────────────────────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Describe distinguishing features, condition, any text visible on the item..."
              placeholderTextColor="#94a3b8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              autoCapitalize="sentences"
            />
          </View>
        </View>

        {/* ── Proof Question ────────────────────────────────────────────────── */}
        <View style={[styles.field, styles.proofSection]}>
          <View style={styles.proofHeader}>
            <Text style={styles.proofLockIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Proof Question *</Text>
              <Text style={styles.proofHint}>
                Only the real owner will know the answer. Only you see it when someone claims the item.
              </Text>
            </View>
          </View>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder='e.g. "What is the name on the ID card?"'
              placeholderTextColor="#94a3b8"
              value={proofQuestion}
              onChangeText={setProofQuestion}
              autoCapitalize="sentences"
            />
          </View>
        </View>

        {/* ── Location notice ───────────────────────────────────────────────── */}
        <View style={styles.locationNotice}>
          <Text style={styles.locationNoticeIcon}>📍</Text>
          <Text style={styles.locationNoticeText}>
            Your current location will be captured automatically when you post, to help the owner narrow down where to look.
          </Text>
        </View>

        {/* ── Submit ────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, (loading || uploadingImage) && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading || uploadingImage}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.submitGrad}>
            {loading
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.submitText}>📋 Post to Community Board</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  scroll:    { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 160 },

  back:       { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backArrow:  { color: '#6366f1', fontSize: 20, marginRight: 6 },
  backLabel:  { color: '#6366f1', fontWeight: '700', fontSize: 15 },

  pageSuper: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  pageTitle: { color: '#0f172a', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  pageHint:  { color: '#64748b', fontSize: 14, fontWeight: '500', lineHeight: 21, marginBottom: 28 },

  // Photo
  photoBox: {
    width: '100%', height: 200, borderRadius: 24, marginBottom: 24,
    overflow: 'hidden', backgroundColor: '#ffffff',
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#e2e8f0',
    shadowColor: '#6366f1', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  photoImage:    { width: '100%', height: '100%' },
  photoOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoOverlayText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  changePhotoBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  changePhotoText:  { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoIconBox:     { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  photoIcon:        { fontSize: 30 },
  photoLabel:       { color: '#475569', fontSize: 15, fontWeight: '700' },
  photoHint:        { color: '#94a3b8', fontSize: 12, fontWeight: '500' },

  // Fields
  field:    { marginBottom: 22 },
  label:    { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  inputBox: {
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 16, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  input:    { color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 14 },

  // Category pills
  pills:       { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1, backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  pillInactive:{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  pillIcon:    { fontSize: 14 },
  pillText:    { color: '#475569', fontSize: 13, fontWeight: '600' },

  // Proof
  proofSection: { backgroundColor: '#fdf4ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 20, padding: 16 },
  proofHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  proofLockIcon:{ fontSize: 22, marginTop: 2 },
  proofHint:    { color: '#7e22ce', fontSize: 12, fontWeight: '500', lineHeight: 18, marginBottom: 4 },

  // Location notice
  locationNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd',
    borderRadius: 16, padding: 14, marginBottom: 28,
  },
  locationNoticeIcon: { fontSize: 18, marginTop: 1 },
  locationNoticeText: { flex: 1, color: '#0369a1', fontSize: 13, fontWeight: '500', lineHeight: 20 },

  // Submit
  submitBtn:  { borderRadius: 20, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  submitGrad: { paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
