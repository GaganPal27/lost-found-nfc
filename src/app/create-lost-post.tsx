import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Animated, StyleSheet, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import * as Location from 'expo-location';
import { updateUserLocation } from '../lib/location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = ['Personal', 'Electronics', 'Bag', 'Keys', 'Wallet', 'Travel', 'Other'];

export default function CreateLostPostScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [radiusKm, setRadiusKm] = useState(5);
  
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Error shake animation
  const shakeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const getLocationWithFallback = async () => {
      // Step 1: Check permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Enable it in Settings.');
        return;
      }

      // Step 2: Race high-accuracy GPS vs 5-second timeout
      const gpsPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 5000)   // resolves null (not reject) — clean exit
      );

      let loc = await Promise.race([gpsPromise, timeoutPromise]);

      // Step 3: Fallback to last known if GPS timed out
      if (!loc) {
        loc = await Location.getLastKnownPositionAsync();
      }

      if (loc) {
        setLocation(loc);
        if (user?.id) updateUserLocation(user.id).catch(() => {});
      } else {
        setLocationError('Could not get location. Please try again outdoors or check GPS settings.');
        setLocation({ coords: { latitude: 0, longitude: 0 } });
      }
    };

    getLocationWithFallback().catch((e) => {
      setLocationError('Location error. Proceeding without GPS.');
      setLocation({ coords: { latitude: 0, longitude: 0 } });
    });
  }, [user?.id]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      triggerShake();
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Location is required. Please wait for GPS or enable permissions.');
      triggerShake();
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }

    setLoading(true);
    
    try {
      // ── STEP 1: Get the real users.id (Postgres UUID) via auth_id ──────────
      // users.id is a generated UUID; auth_id holds the Supabase auth UID.
      // lost_item_posts.poster_id references users.id — NOT the auth UID.
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (profileError || !profile) {
        Alert.alert('Error', 'Could not find your user profile. Please try logging out and back in.');
        return;
      }

      const dbUserId = profile.id; // This is the real users.id Postgres UUID

      // Insert post
      const { data, error } = await supabase.from('lost_item_posts').insert({
        poster_id: dbUserId, // ✅ real users.id, not auth UID
        title: title.trim(),
        category,
        description: description.trim(),
        last_seen_lat: location.coords.latitude,
        last_seen_lng: location.coords.longitude,
        radius_km: radiusKm,
        status: 'searching'
      }).select().single();

      if (error) throw error;

      // Trigger edge function asynchronously to notify nearby users
      supabase.functions.invoke('notify-lost-item-radius', {
        body: { record: data }
      }).catch(console.error); // don't await, let it run in background

      Alert.alert('Success', 'Lost item posted. Nearby users have been notified!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}>
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          
          <Text style={styles.headerTitle}>Report Lost Item</Text>
          <Text style={styles.headerSubtitle}>
            We'll notify users within your selected radius.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Item Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Black Leather Wallet"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
                <Text style={styles.pickerText}>{category}</Text>
                <Text style={{color: '#64748b'}}>▼</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any distinguishing features?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.radiusHeader}>
              <Text style={styles.label}>Alert Radius</Text>
              <Text style={styles.radiusValue}>{radiusKm} km</Text>
            </View>
            
            <View style={styles.sliderRow}>
              {[1, 5, 10, 25, 50].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.radiusBtn, radiusKm === val && styles.radiusBtnActive]}
                  onPress={() => setRadiusKm(val)}
                >
                  <Text style={[styles.radiusBtnText, radiusKm === val && styles.radiusBtnTextActive]}>
                    {val}k
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.locationBox}>
              <Text style={styles.locationTitle}>Your Current Location</Text>
              {location ? (
                <Text style={styles.locationText}>
                  📍 {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
                </Text>
              ) : locationError ? (
                <Text style={styles.errorText}>{locationError}</Text>
              ) : (
                <View style={styles.loadingLoc}>
                  <ActivityIndicator size="small" color="#6366f1" />
                  <Text style={styles.locationText}> Acquiring GPS...</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!location || !title) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !location}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Post & Notify Nearby</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      {/* Custom Picker Modal */}
      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} onPress={() => { setCategory(c); setShowPicker(false); }} style={styles.modalItem}>
                <Text style={[styles.modalItemText, category === c && { color: '#6366f1', fontWeight: 'bold' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  scroll: { padding: 20, paddingBottom: 140 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#0f172a', marginBottom: 20,
  },
  inputContainer: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, marginBottom: 20,
  },
  pickerButton: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 15, color: '#0f172a' },
  textArea: { height: 100 },
  radiusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  radiusValue: { fontSize: 16, fontWeight: '800', color: '#6366f1' },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  radiusBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  radiusBtnActive: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  radiusBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  radiusBtnTextActive: { color: '#fff' },

  locationBox: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  locationTitle: { fontSize: 12, fontWeight: '700', color: '#166534', marginBottom: 4 },
  locationText: { fontSize: 13, color: '#15803d', fontWeight: '500' },
  errorText: { fontSize: 13, color: '#e11d48', fontWeight: '500' },
  loadingLoc: { flexDirection: 'row', alignItems: 'center' },

  submitBtn: {
    backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', shadowColor: '#6366f1', shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: '#0f172a' },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 16, color: '#475569' },
  modalCancel: { marginTop: 20, alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});
