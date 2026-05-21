import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, ScrollView,
  ActivityIndicator, Animated, StatusBar, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

type Step = 'confirm' | 'location' | 'contact' | 'sent';

export default function FinderConnectScreen() {
  const { item_id, owner_id, item_name } = useLocalSearchParams<{
    item_id: string;
    owner_id: string;
    item_name: string;
  }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [step, setStep] = useState<Step>('confirm');
  const [loading, setLoading] = useState(false);
  const [finderName, setFinderName] = useState('');
  const [finderPhone, setFinderPhone] = useState('');
  const [message, setMessage] = useState('');
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    // Pre-fill if user is logged in
    if (user?.email) setFinderName(user.email.split('@')[0]);
  }, []);

  // ── Location capture ────────────────────────────────────────────────────────
  const captureLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLabel(null);
        setCoords(null);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      // Reverse geocode for a human-readable label
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (place) {
          const parts = [place.name, place.district || place.subregion, place.city].filter(Boolean);
          setLocationLabel(parts.join(', '));
        }
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  // ── Send notification & create conversation ─────────────────────────────────
  const handleSend = async () => {
    if (!finderName.trim()) {
      Alert.alert('Required', 'Please enter your name so the owner can reach you.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Required', 'Please write a short message to the owner.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          item_id,
          owner_id,
          finder_user_id: user?.id ?? null,
          finder_name: finderName.trim(),
          finder_phone: finderPhone.trim() || null,
          scan_lat: coords?.lat ?? null,
          scan_lng: coords?.lng ?? null,
          scan_location: locationLabel,
        })
        .select()
        .single();

      if (convError || !conv) throw convError ?? new Error('Could not create conversation');

      // 2. Insert initial message
      await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: user?.id ?? null,
        sender_name: finderName.trim(),
        body: message.trim(),
      });

      // 3. Insert in-app notification for the owner
      await supabase.from('notifications').insert({
        user_id: owner_id,
        type: 'nfc_tap',
        message: `${finderName.trim()} found your "${item_name}"${locationLabel ? ` near ${locationLabel}` : ''}`,
        metadata: {
          item_id,
          conversation_id: conv.id,
          finder_name: finderName.trim(),
          location_label: locationLabel,
          lat: coords?.lat,
          lng: coords?.lng,
        },
      });

      // 4. Call push notification edge function
      await supabase.functions.invoke('send-push-notification', {
        body: {
          owner_id,
          conversation_id: conv.id,
          item_name,
          finder_name: finderName.trim(),
          location_label: locationLabel,
        },
      });

      setConversationId(conv.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('sent');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not send notification. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepConfig = {
    confirm: { title: 'Found Something?', emoji: '🔍', sub: `You scanned a Lost & Found tag for\n"${item_name}"` },
    location: { title: 'Share Location?', emoji: '📍', sub: 'Let the owner know where you found it' },
    contact:  { title: 'Contact the Owner', emoji: '💬', sub: 'Leave your details so they can reach you' },
    sent:     { title: 'Owner Notified!', emoji: '✅', sub: 'They\'ll reach out to you shortly' },
  };

  const cfg = stepConfig[step];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <View className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          {step !== 'sent' && (
            <TouchableOpacity onPress={() => router.back()} className="mb-8 flex-row items-center" activeOpacity={0.7}>
              <Text className="text-primary text-lg mr-1">←</Text>
              <Text className="text-primary font-semibold">Back</Text>
            </TouchableOpacity>
          )}

          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
            {/* Header */}
            <View className="items-center mb-8">
              <View className="w-24 h-24 bg-white border border-slate-200 rounded-full items-center justify-center mb-5"
                style={{ shadowColor: '#e11d48', shadowOpacity: 0.2, shadowRadius: 16, elevation: 5 }}>
                <Text style={{ fontSize: 44 }}>{cfg.emoji}</Text>
              </View>
              <Text className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-bold">Step {['confirm','location','contact','sent'].indexOf(step) + 1} of 3</Text>
              <Text className="text-slate-900 text-3xl font-black text-center mb-2">{cfg.title}</Text>
              <Text className="text-slate-500 text-base text-center leading-6 font-medium">{cfg.sub}</Text>
            </View>

            {/* ── Step 1: Confirm ─────────────────────────────────────────── */}
            {step === 'confirm' && (
              <View className="gap-4">
                {/* Item info card */}
                <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-2 shadow-sm">
                  <View className="flex-row items-center">
                    <View className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl items-center justify-center mr-4">
                      <Text className="text-3xl">🏷️</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-xs uppercase tracking-wider mb-0.5 font-bold">Registered Item</Text>
                      <Text className="text-slate-900 font-bold text-lg">{item_name}</Text>
                      <Text className="text-green-600 font-medium text-sm">Owner has been notified ✓</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  className="w-full bg-primary py-5 rounded-2xl items-center shadow-md shadow-primary/30"
                  onPress={() => setStep('location')}
                  activeOpacity={0.85}
                >
                  <Text className="text-white font-bold text-lg">I Found This Item →</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="py-4 items-center"
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                >
                  <Text className="text-slate-500 font-semibold">Not my concern — go back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 2: Location consent ────────────────────────────────── */}
            {step === 'location' && (
              <View className="gap-4">
                <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-2 shadow-sm">
                  <Text className="text-slate-900 font-bold mb-2">Why share location?</Text>
                  <Text className="text-slate-500 text-sm leading-6 font-medium">
                    Your approximate location at this moment (e.g. "Saket, Delhi") helps the owner know
                    where to look. We never share your GPS coordinates directly — only a reverse-coded
                    area name.
                  </Text>

                  {locationLabel && (
                    <View className="mt-4 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
                      <Text className="text-primary text-xs uppercase tracking-wider mb-1 font-bold">Location Captured</Text>
                      <Text className="text-slate-900 font-bold">{locationLabel}</Text>
                    </View>
                  )}
                </View>

                {!locationLabel ? (
                  <TouchableOpacity
                    className={`w-full bg-primary py-5 rounded-2xl items-center shadow-md shadow-primary/30 ${loading ? 'opacity-60' : ''}`}
                    onPress={captureLocation}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#ffffff" />
                      : <Text className="text-white font-bold text-lg">📍 Allow Location & Continue</Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="w-full bg-primary py-5 rounded-2xl items-center shadow-md shadow-primary/30"
                    onPress={() => setStep('contact')}
                    activeOpacity={0.85}
                  >
                    <Text className="text-white font-bold text-lg">Continue →</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  className="py-4 items-center"
                  onPress={() => setStep('contact')}
                  activeOpacity={0.7}
                >
                  <Text className="text-slate-500 font-semibold">Skip — don't share location</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 3: Contact details + message ──────────────────────── */}
            {step === 'contact' && (
              <View className="gap-4">
                <View className="bg-white border border-slate-200 rounded-3xl p-5 gap-4 shadow-sm">
                  {/* Name */}
                  <View>
                    <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Your Name *</Text>
                    <View className="bg-slate-50 border border-slate-200 rounded-2xl px-4 flex-row items-center">
                      <Text className="text-slate-500 text-lg mr-3">👤</Text>
                      <TextInput
                        className="flex-1 text-slate-900 py-4 text-base font-medium"
                        placeholder="How should the owner address you?"
                        placeholderTextColor="#94a3b8"
                        value={finderName}
                        onChangeText={setFinderName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  {/* Phone */}
                  <View>
                    <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Phone (optional)</Text>
                    <View className="bg-slate-50 border border-slate-200 rounded-2xl px-4 flex-row items-center">
                      <Text className="text-slate-500 text-lg mr-3">📞</Text>
                      <TextInput
                        className="flex-1 text-slate-900 py-4 text-base font-medium"
                        placeholder="Your contact number"
                        placeholderTextColor="#94a3b8"
                        value={finderPhone}
                        onChangeText={setFinderPhone}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <Text className="text-slate-500 text-xs mt-1 ml-1 font-medium">
                      Only shared with the registered owner
                    </Text>
                  </View>

                  {/* Message */}
                  <View>
                    <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Message *</Text>
                    <View className="bg-slate-50 border border-slate-200 rounded-2xl px-4">
                      <TextInput
                        className="text-slate-900 py-4 text-base font-medium"
                        placeholder={`e.g. "Hi! I found your ${item_name} at the metro station. Happy to help return it."`}
                        placeholderTextColor="#94a3b8"
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        style={{ minHeight: 100 }}
                      />
                    </View>
                  </View>
                </View>

                {locationLabel && (
                  <View className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 flex-row items-center">
                    <Text className="text-primary mr-2">📍</Text>
                    <Text className="text-primary text-sm font-semibold flex-1">{locationLabel}</Text>
                  </View>
                )}

                <TouchableOpacity
                  className={`w-full bg-primary py-5 rounded-2xl items-center shadow-md shadow-primary/30 ${loading ? 'opacity-60' : ''}`}
                  onPress={handleSend}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#ffffff" />
                    : <Text className="text-white font-bold text-lg">Send to Owner 🚀</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 4: Success ─────────────────────────────────────────── */}
            {step === 'sent' && (
              <View className="items-center gap-4">
                <View className="bg-white border border-slate-200 rounded-3xl p-6 w-full gap-3 shadow-sm">
                  <View className="flex-row items-center">
                    <Text className="text-primary mr-3 text-xl">🔔</Text>
                    <Text className="text-slate-900 font-bold">Owner notified via push notification</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-primary mr-3 text-xl">💬</Text>
                    <Text className="text-slate-900 font-bold">Conversation created</Text>
                  </View>
                  {locationLabel && (
                    <View className="flex-row items-center">
                      <Text className="text-primary mr-3 text-xl">📍</Text>
                      <Text className="text-slate-900 font-bold">Location shared: {locationLabel}</Text>
                    </View>
                  )}
                  {finderPhone && (
                    <View className="flex-row items-center">
                      <Text className="text-primary mr-3 text-xl">📞</Text>
                      <Text className="text-slate-900 font-bold">Your phone shared with owner</Text>
                    </View>
                  )}
                </View>

                <Text className="text-slate-500 text-center text-sm leading-6 px-4 font-medium">
                  Thank you for being a good samaritan! 🙏{'\n'}
                  The owner will contact you using the details you provided.
                </Text>

                {/* If the finder is logged in, they can open the conversation */}
                {user && conversationId && (
                  <TouchableOpacity
                    className="w-full bg-primary py-5 rounded-2xl items-center shadow-md shadow-primary/30"
                    onPress={() => router.replace(`/conversation/${conversationId}`)}
                    activeOpacity={0.85}
                  >
                    <Text className="text-white font-bold text-lg">Open Chat →</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  className="py-4 items-center"
                  onPress={() => router.replace('/(tabs)/scan')}
                  activeOpacity={0.7}
                >
                  <Text className="text-slate-400 font-semibold">Back to Scanner</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
