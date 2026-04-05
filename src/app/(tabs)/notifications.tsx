import { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Platform, UIManager, LayoutAnimation, StatusBar, Animated } from 'react-native';
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

  const fadeIn = useRef(new Animated.Value(0)).current;

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
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchNotifs();

    const sub = supabase.channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` }, () => {
        fetchNotifs();
      }).subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [user]);

  const onRefresh = async () => { setRefreshing(true); await fetchNotifs(); setRefreshing(false); };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const handlePress = (item: any) => {
    if (!item.is_read) markRead(item.id);
    if (item.type === 'nfc_tap') {
      router.push(`/notification/${item.id}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View className="px-6 pt-14 pb-5 border-b border-darkBorder">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-slate-400 text-xs uppercase tracking-widest mb-1">Alerts</Text>
            <View className="flex-row items-center">
              <Text className="text-white text-3xl font-bold mr-3">Activity</Text>
              {unreadCount > 0 && (
                <View className="bg-primary w-6 h-6 rounded-full items-center justify-center">
                  <Text className="text-slate-900 text-xs font-bold">{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            className="w-11 h-11 bg-darkCard border border-darkBorder rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-white font-bold">{user?.email?.[0]?.toUpperCase() || 'U'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={{ opacity: fadeIn, flex: 1 }}>
        <FlatList
          data={notifications}
          keyExtractor={x => x.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#06b6d4"
              colors={['#06b6d4']}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-28">
              <View className="w-24 h-24 bg-darkCard border border-darkBorder rounded-full items-center justify-center mb-6">
                <Text className="text-4xl">📭</Text>
              </View>
              <Text className="text-white text-xl font-bold mb-2">All quiet</Text>
              <Text className="text-slate-400 text-center px-10 leading-6">
                When someone scans your lost item{'\n'}or it's detected nearby, it'll appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handlePress(item)}
              className={`rounded-3xl mb-4 border overflow-hidden ${
                item.is_read
                  ? 'bg-darkCard border-darkBorder'
                  : 'bg-cyan-950/60 border-cyan-700/50'
              }`}
            >
              {/* Unread accent bar */}
              {!item.is_read && <View className="h-0.5 bg-primary w-full" />}

              <View className="p-5">
                <View className="flex-row items-start mb-3">
                  <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
                    item.type === 'nfc_tap' ? 'bg-primary/20 border border-primary/30' : 'bg-slate-700/50 border border-slate-600'
                  }`}>
                    <Text className="text-2xl">{item.type === 'nfc_tap' ? '📱' : '📡'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`font-bold text-base mb-0.5 ${item.is_read ? 'text-slate-300' : 'text-white'}`}>
                      {item.type === 'nfc_tap' ? 'Item Scanned by Finder' : 'Passive Network Sighting'}
                    </Text>
                    <Text className="text-xs text-slate-500 font-medium">
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {!item.is_read && (
                    <View className="w-2.5 h-2.5 rounded-full bg-primary mt-1" />
                  )}
                </View>

                <Text className={`leading-6 text-sm ${item.is_read ? 'text-slate-400' : 'text-slate-300'}`}>
                  {item.message}
                </Text>

                {item.type === 'nfc_tap' && (
                  <View className="mt-4 flex-row items-center">
                    <Text className="text-primary font-bold text-xs tracking-wider uppercase">
                      Review & Reply →
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    </View>
  );
}
