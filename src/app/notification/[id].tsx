import { useEffect, useState } from 'react';
import { View, Text, Switch, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const router = useRouter();

  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharePhone, setSharePhone] = useState(false);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function loadNotif() {
      const { data } = await supabase.from('notifications').select('*').eq('id', id).single();
      if (data) {
        setNotification(data);
        if (!data.is_read) {
          await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        }
      }
      setLoading(false);
    }
    loadNotif();
  }, [id]);

  const handleSendInfo = async () => {
    setSending(true);
    setTimeout(() => {
      Alert.alert('✅ Information Shared', 'The finder has received your details.');
      setSending(false);
      router.back();
    }, 1000);
  };

  const canSend = sharePhone || shareLiveLocation || message.trim().length > 0;

  if (loading) return (
    <View className="flex-1 bg-darkBg justify-center items-center">
      <ActivityIndicator size="large" color="#06b6d4" />
    </View>
  );
  if (!notification) return (
    <View className="flex-1 bg-darkBg justify-center items-center">
      <Text className="text-slate-400">Notification not found</Text>
    </View>
  );

  const { metadata } = notification;

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Activity</Text>
        </TouchableOpacity>

        {/* Alert Banner */}
        <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-3xl p-5 mb-6 flex-row items-center">
          <View className="w-14 h-14 bg-cyan-500/20 rounded-2xl items-center justify-center mr-4">
            <Text className="text-3xl">📱</Text>
          </View>
          <View className="flex-1">
            <Text className="text-cyan-300 font-bold text-base mb-0.5">Item Found!</Text>
            <Text className="text-slate-400 text-sm">Someone scanned your lost item</Text>
          </View>
        </View>

        <Text className="text-white text-2xl font-bold mb-6">Coordinate Return</Text>

        {/* Location */}
        <View className="bg-darkCard border border-darkBorder rounded-3xl p-5 mb-5">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-1 font-semibold">Scan Location</Text>
          <Text className="text-white text-lg font-bold">
            {metadata?.location_label || 'Unknown Area'}
          </Text>
          {metadata?.scanned_at && (
            <Text className="text-slate-500 text-sm mt-1">
              Scanned: {new Date(metadata.scanned_at).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Share Options */}
        <View className="bg-darkCard border border-darkBorder rounded-3xl overflow-hidden mb-5">
          <View className="px-5 pt-4 pb-2">
            <Text className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Share with Finder</Text>
          </View>

          <TouchableOpacity
            className="flex-row justify-between items-center px-5 py-4 border-b border-slate-700"
            activeOpacity={0.7}
            onPress={() => setSharePhone(!sharePhone)}
          >
            <View className="flex-row items-center">
              <Text className="text-xl mr-3">📞</Text>
              <View>
                <Text className="text-white font-semibold">Phone Number</Text>
                <Text className="text-slate-500 text-xs">Finder can call you to arrange pickup</Text>
              </View>
            </View>
            <Switch
              value={sharePhone}
              onValueChange={setSharePhone}
              trackColor={{ true: '#06b6d4', false: '#334155' }}
              thumbColor={sharePhone ? '#22d3ee' : '#94a3b8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row justify-between items-center px-5 py-4"
            activeOpacity={0.7}
            onPress={() => setShareLiveLocation(!shareLiveLocation)}
          >
            <View className="flex-row items-center">
              <Text className="text-xl mr-3">📍</Text>
              <View>
                <Text className="text-white font-semibold">Live Location</Text>
                <Text className="text-slate-500 text-xs">Share your current location for meetup</Text>
              </View>
            </View>
            <Switch
              value={shareLiveLocation}
              onValueChange={setShareLiveLocation}
              trackColor={{ true: '#06b6d4', false: '#334155' }}
              thumbColor={shareLiveLocation ? '#22d3ee' : '#94a3b8'}
            />
          </TouchableOpacity>
        </View>

        {/* Message */}
        <View className="mb-6">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-semibold">Message to Finder</Text>
          <View className="bg-darkCard border border-darkBorder rounded-2xl px-4 py-3">
            <TextInput
              className="text-white text-base"
              multiline
              textAlignVertical="top"
              placeholder="e.g. Please leave it at the front desk of the library..."
              placeholderTextColor="#475569"
              value={message}
              onChangeText={setMessage}
              style={{ minHeight: 100 }}
            />
          </View>
          <Text className="text-slate-600 text-xs mt-2">
            Select at least one option or write a message to send.
          </Text>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          className={`w-full bg-primary py-4 rounded-2xl items-center flex-row justify-center ${(!canSend || sending) ? 'opacity-40' : ''}`}
          disabled={!canSend || sending}
          onPress={handleSendInfo}
          activeOpacity={0.85}
          style={{ shadowColor: '#06b6d4', shadowOpacity: canSend ? 0.35 : 0, shadowRadius: 12, elevation: 5 }}
        >
          {sending ? <ActivityIndicator color="#0f172a" /> : (
            <Text className="text-slate-900 font-bold text-lg">Send to Finder →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
