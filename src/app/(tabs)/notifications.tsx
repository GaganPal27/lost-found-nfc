import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Platform, UIManager, LayoutAnimation } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  useEffect(() => {
    fetchNotifs();
    
    const sub = supabase.channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` }, () => {
         fetchNotifs();
      }).subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifs();
    setRefreshing(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const handlePress = (item: any) => {
    if (!item.is_read) markRead(item.id);
    if (item.type === 'nfc_tap') {
       router.push(`/notification/${item.id}`);
    } else {
       // Since it's a ble ping, just show read state
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
       <View className="px-6 pt-12 pb-4 bg-white border-b border-gray-100 flex-row justify-between items-center">
         <Text className="text-3xl font-bold text-gray-900 mt-4">Activity</Text>
         <TouchableOpacity onPress={() => router.push('/profile')} className="bg-gray-100 w-12 h-12 rounded-full items-center justify-center mt-4 border border-gray-200 shadow-sm">
            <Text className="text-xl">👤</Text>
         </TouchableOpacity>
       </View>

       <FlatList
         data={notifications}
         keyExtractor={x => x.id}
         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
         contentContainerStyle={{ padding: 16 }}
         ListEmptyComponent={
            <View className="items-center justify-center py-20 mt-12">
               <Text className="text-6xl mb-4">📭</Text>
               <Text className="text-gray-500 font-bold text-xl">No notifications</Text>
               <Text className="text-gray-400 text-center px-10 mt-3 leading-6">When someone scans your lost item or it's detected nearby, you'll see it here.</Text>
            </View>
         }
         renderItem={({ item }) => (
            <TouchableOpacity 
               activeOpacity={0.7}
               onPress={() => handlePress(item)}
               className={`p-5 rounded-3xl mb-4 border ${item.is_read ? 'bg-white border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' : 'bg-teal-50 border-teal-200 shadow-[0_4px_12px_rgba(13,148,136,0.1)]'}`}
            >
               <View className="flex-row items-center mb-3">
                  <Text className="text-2xl mr-3">{item.type === 'nfc_tap' ? '📱' : '📡'}</Text>
                  <View className="flex-1">
                     <Text className={`font-bold text-lg ${item.is_read ? 'text-gray-900' : 'text-teal-900'}`}>{item.type === 'nfc_tap' ? 'Item tapped by Finder' : 'Passive Network Sighting'}</Text>
                     <Text className="text-xs text-gray-500 font-medium">{new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                  {!item.is_read && <View className="w-3 h-3 rounded-full bg-teal-500 shadow-sm" />}
               </View>
               <Text className={`leading-6 ${item.is_read ? 'text-gray-600' : 'text-gray-800 font-medium'}`}>{item.message}</Text>
               
               {item.type === 'nfc_tap' && (
                  <Text className="text-teal-700 font-bold mt-4 text-sm tracking-wide">REVIEW & REPLY →</Text>
               )}
            </TouchableOpacity>
         )}
       />
    </View>
  );
}
