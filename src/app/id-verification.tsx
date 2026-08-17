import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Alert,
  StatusBar, StyleSheet, ActivityIndicator, ScrollView, BackHandler,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export default function IdVerificationScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { dbUser } = useAuthStore();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();

  const [imageUri, setImageUri]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Intercept Android hardware back — always go to community, never to a legacy screen
  const goBack = useCallback(() => {
    router.replace('/(tabs)/community' as any);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true; // prevent default back behaviour
      });
      return () => sub.remove();
    }, [goBack])
  );

  // ── Pick from gallery ────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload your ID.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  // ── Take a photo ─────────────────────────────────────────────────────────
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to photograph your ID.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!imageUri)   { Alert.alert('No photo selected', 'Please select or photograph your college ID first.'); return; }
    if (!dbUser?.id) { Alert.alert('Not signed in', 'Please log in and try again.'); return; }
    if (!groupId)    { Alert.alert('Error', 'Community not found. Please go back and try again.'); return; }

    setUploading(true);
    try {
      // 1. Fetch the raw image bytes
      const response  = await fetch(imageUri);
      const blob      = await response.blob();
      const ext       = imageUri.split('.').pop() ?? 'jpg';
      const fileName  = `${dbUser.id}/${groupId}.${ext}`;

      // 2. Upload to Supabase Storage (id-verifications bucket, private)
      const { error: uploadError } = await supabase.storage
        .from('id-verifications')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      // 3. Get the storage path (not a public URL — bucket is private)
      const storagePath = `id-verifications/${fileName}`;

      // 4. Upsert into id_verifications — handles both first upload AND re-uploads
      const { error: dbError } = await supabase
        .from('id_verifications')
        .upsert({
          user_id:     dbUser.id,
          group_id:    groupId,
          id_card_url: storagePath,
          status:      'pending',
          submitted_at: new Date().toISOString(),
          reviewed_at:  null,
        }, { onConflict: 'user_id,group_id' });

      if (dbError) throw new Error(dbError.message);

      // 5. Update group_members.membership_status → 'requested' (handles re-upload after rejection)
      await supabase
        .from('group_members')
        .update({ membership_status: 'requested' })
        .eq('user_id', dbUser.id)
        .eq('group_id', groupId);

      Alert.alert(
        '✅ ID Submitted',
        'Your student ID has been submitted for review. You can post while it\'s being reviewed.',
        [{ text: 'Go to Community', onPress: () => router.replace('/(tabs)/community' as any) }]
      );
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* Header */}
      <LinearGradient
        colors={['#6366f1', '#7c3aed']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerEmoji}>🪪</Text>
        <Text style={styles.headerTitle}>Verify Your Enrolment</Text>
        <Text style={styles.headerSub}>
          Upload your college ID card so we can confirm you're a student here.
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What we check</Text>
          <Text style={styles.infoText}>
            • Your name and college/institution name must be visible{'\n'}
            • Enrollment year or student ID number helps{'\n'}
            • A blurry or cropped photo will be rejected — take a clear, well-lit photo
          </Text>
          <View style={styles.softTrustTag}>
            <Text style={styles.softTrustText}>📌 Requested, not yet Verified</Text>
          </View>
          <Text style={styles.softTrustSub}>
            You can post while your ID is under review. "Requested" means we've received it, not that it's been approved yet.
          </Text>
        </View>

        {/* Photo picker */}
        {imageUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            <TouchableOpacity onPress={() => setImageUri(null)} style={styles.retakeBtn} activeOpacity={0.8}>
              <Text style={styles.retakeBtnText}>Choose a different photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pickerRow}>
            <TouchableOpacity style={styles.pickerBtn} onPress={pickFromCamera} activeOpacity={0.85}>
              <Text style={styles.pickerIcon}>📷</Text>
              <Text style={styles.pickerBtnText}>Take Photo</Text>
              <Text style={styles.pickerBtnSub}>Use your camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerBtn} onPress={pickFromGallery} activeOpacity={0.85}>
              <Text style={styles.pickerIcon}>🖼️</Text>
              <Text style={styles.pickerBtnText}>Choose from Gallery</Text>
              <Text style={styles.pickerBtnSub}>Pick an existing photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!imageUri || uploading}
          activeOpacity={0.88}
          style={{ borderRadius: 18, overflow: 'hidden', marginTop: 8 }}
        >
          <LinearGradient
            colors={imageUri && !uploading ? ['#6366f1', '#7c3aed'] : ['#e2e8f0', '#e2e8f0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.submitBtn}
          >
            {uploading
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={[styles.submitBtnText, (!imageUri) && { color: '#94a3b8' }]}>
                  Submit for Review
                </Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/community' as any)}
          activeOpacity={0.7}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip for now — I'll do this later</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  header: {
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 36,
  },
  backBtn:    { alignSelf: 'flex-start', marginBottom: 20 },
  backText:   { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  headerEmoji: { fontSize: 48, marginBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  headerSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', lineHeight: 21 },

  body: {
    backgroundColor: '#f8faff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24, paddingHorizontal: 16, paddingTop: 24,
  },

  infoCard: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: '#e0e7ff',
    shadowColor: '#6366f1', shadowOpacity: 0.07, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  infoTitle:    { color: '#0f172a', fontWeight: '800', fontSize: 15, marginBottom: 10 },
  infoText:     { color: '#475569', fontSize: 13, lineHeight: 22, marginBottom: 14 },
  softTrustTag: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 8 },
  softTrustText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  softTrustSub:  { color: '#64748b', fontSize: 12, lineHeight: 18 },

  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  pickerBtn: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 20,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0',
    shadowColor: '#6366f1', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  pickerIcon:    { fontSize: 36, marginBottom: 10 },
  pickerBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 14, textAlign: 'center', marginBottom: 4 },
  pickerBtnSub:  { color: '#94a3b8', fontSize: 11, textAlign: 'center' },

  previewWrap: { marginBottom: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  preview:     { width: '100%', height: 220 },
  retakeBtn:   { backgroundColor: '#f8faff', paddingVertical: 14, alignItems: 'center' },
  retakeBtnText: { color: '#6366f1', fontSize: 14, fontWeight: '700' },

  submitBtn:     { paddingVertical: 17, alignItems: 'center', borderRadius: 18 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  skipBtn:  { alignItems: 'center', marginTop: 16 },
  skipText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});
