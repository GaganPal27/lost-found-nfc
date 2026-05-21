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
    <View className="flex-1 bg-slate-50 justify-center items-center">
      <ActivityIndicator size="large" color="#e11d48" />
    </View>
  );
  if (!notification) return (
    <View className="flex-1 bg-slate-50 justify-center items-center">
      <Text className="text-slate-500 font-medium">Notification not found</Text>
    </View>
  );

  const { metadata } = notification;

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Activity</Text>
        </TouchableOpacity>

        {/* Alert Banner */}
        <View className="bg-blue-50 border border-blue-200 rounded-3xl p-5 mb-6 flex-row items-center shadow-sm">
          <View className="w-14 h-14 bg-blue-100 rounded-2xl items-center justify-center mr-4">
            <Text className="text-3xl">📱</Text>
          </View>
          <View className="flex-1">
            <Text className="text-blue-700 font-bold text-base mb-0.5">Item Found!</Text>
            <Text className="text-slate-600 text-sm font-medium">Someone scanned your lost item</Text>
          </View>
        </View>

        <Text className="text-slate-900 text-2xl font-black mb-6">Coordinate Return</Text>

        {/* Location */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-1 font-bold">Scan Location</Text>
          <Text className="text-slate-900 text-lg font-bold">
            {metadata?.location_label || 'Unknown Area'}
          </Text>
          {metadata?.scanned_at && (
            <Text className="text-slate-500 text-sm mt-1 font-medium">
              Scanned: {new Date(metadata.scanned_at).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Share Options */}
        <View className="bg-white border border-slate-200 rounded-3xl overflow-hidden mb-5 shadow-sm">
          <View className="px-5 pt-4 pb-2">
            <Text className="text-slate-500 text-xs uppercase tracking-wider font-bold">Share with Finder</Text>
          </View>

          <TouchableOpacity
            className="flex-row justify-between items-center px-5 py-4 border-b border-slate-100"
            activeOpacity={0.7}
            onPress={() => setSharePhone(!sharePhone)}
          >
            <View className="flex-row items-center">
              <Text className="text-xl mr-3">📞</Text>
              <View>
                <Text className="text-slate-900 font-bold">Phone Number</Text>
                <Text className="text-slate-500 text-xs font-medium">Finder can call you to arrange pickup</Text>
              </View>
            </View>
            <Switch
              value={sharePhone}
              onValueChange={setSharePhone}
              trackColor={{ true: '#e11d48', false: '#e2e8f0' }}
              thumbColor={sharePhone ? '#ffffff' : '#f1f5f9'}
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
                <Text className="text-slate-900 font-bold">Live Location</Text>
                <Text className="text-slate-500 text-xs font-medium">Share your current location for meetup</Text>
              </View>
            </View>
            <Switch
              value={shareLiveLocation}
              onValueChange={setShareLiveLocation}
              trackColor={{ true: '#e11d48', false: '#e2e8f0' }}
              thumbColor={shareLiveLocation ? '#ffffff' : '#f1f5f9'}
            />
          </TouchableOpacity>
        </View>

        {/* Message */}
        <View className="mb-6">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold">Message to Finder</Text>
          <View className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <TextInput
              className="text-slate-900 text-base font-medium"
              multiline
              textAlignVertical="top"
              placeholder="e.g. Please leave it at the front desk of the library..."
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              style={{ minHeight: 100 }}
            />
          </View>
          <Text className="text-slate-500 text-xs mt-2 font-medium">
            Select at least one option or write a message to send.
          </Text>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          className={`w-full bg-primary py-4 rounded-2xl items-center flex-row justify-center shadow-md shadow-primary/30 ${(!canSend || sending) ? 'opacity-40' : ''}`}
          disabled={!canSend || sending}
          onPress={handleSendInfo}
          activeOpacity={0.85}
        >
          {sending ? <ActivityIndicator color="#ffffff" /> : (
            <Text className="text-white font-bold text-lg tracking-wide">Send to Finder →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
