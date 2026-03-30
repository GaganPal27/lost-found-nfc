import { useEffect, useState } from 'react';
import { View, Text, Switch, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
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
      Alert.alert('Information Shared', 'The finder will receive your details.');
      setSending(false);
      router.back();
    }, 1000);
  };

  if (loading) return <View className="flex-1 pt-20 items-center"><ActivityIndicator /></View>;
  if (!notification) return <View className="flex-1 pt-20 items-center"><Text>Not found</Text></View>;

  const { metadata } = notification;

  return (
    <ScrollView className="flex-1 bg-gray-50 p-6">
      <Text className="text-3xl font-bold mb-6 mt-4 text-gray-900">Item Found!</Text>

      <View className="bg-white p-4 rounded-xl border border-gray-200 mb-6 shadow-sm">
        <Text className="text-gray-500 font-medium mb-1">Location</Text>
        <Text className="text-lg font-bold text-gray-900">{metadata?.location_label || 'Unknown Map Area'}</Text>
        {metadata?.scanned_at && (
          <Text className="text-sm text-gray-500 mt-2">Scanned at: {new Date(metadata.scanned_at).toLocaleString()}</Text>
        )}
      </View>

      <Text className="text-xl font-bold text-gray-900 mb-4">Coordinate Return</Text>
      
      <View className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
        <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
           <Text className="text-lg text-gray-800 font-medium">Share Phone Number</Text>
           <Switch value={sharePhone} onValueChange={setSharePhone} trackColor={{ true: '#0d9488' }} />
        </View>
        <View className="flex-row justify-between items-center p-4">
           <Text className="text-lg text-gray-800 font-medium">Share Live Location</Text>
           <Switch value={shareLiveLocation} onValueChange={setShareLiveLocation} trackColor={{ true: '#0d9488' }} />
        </View>
      </View>

      <Text className="text-gray-700 font-semibold mb-2">Message to finder</Text>
      <TextInput
        className="bg-white p-4 rounded-xl border border-gray-200 h-32 mb-6"
        multiline
        textAlignVertical="top"
        placeholder="e.g. Please leave it at the library front desk."
        value={message}
        onChangeText={setMessage}
      />

      <TouchableOpacity
        className={`w-full bg-primary p-4 rounded-xl items-center ${(sharePhone || shareLiveLocation || message.length > 0) && !sending ? '' : 'opacity-50'}`}
        disabled={(!sharePhone && !shareLiveLocation && message.length === 0) || sending}
        onPress={handleSendInfo}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg tracking-wide">Send to Finder</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
