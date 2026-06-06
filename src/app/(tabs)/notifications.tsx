import { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Platform, UIManager, LayoutAnimation, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function NotificationsScreen() {
  const { user, dbUser } = useAuthStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnreadScanned, setHasUnreadScanned] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef  = useRef<any>(null);

  // Only pulse when there are unread scanned items
  useEffect(() => {
    if (hasUnreadScanned) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseRef.current?.stop();
  }, [hasUnreadScanned]);

  const fetchNotifs = async () => {
    // Use dbUser.id (the users table PK) - NOT user.id (auth UUID)
    const uid = dbUser?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100);
    const list = data || [];
    setNotifications(list);
    setHasUnreadScanned(list.some((n: any) => n.type === 'nfc_tap' && !n.is_read));
  };

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dbUser?.id) return;
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchNotifs();

    const uid = dbUser.id;
    const sub = supabase.channel(`notifs_screen_${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
        if (payload.new.type === 'nfc_tap') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}), 200);
        }
        fetchNotifs();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
        fetchNotifs();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [dbUser?.id]);

  const onRefresh = async () => { setRefreshing(true); await fetchNotifs(); setRefreshing(false); };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const handlePress = (item: any) => {
    if (!item.is_read) markRead(item.id);
    if (item.type === 'nfc_tap' || item.metadata?.community_item_id) {
      router.push(`/notification/${item.id}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View className="px-6 pt-14 pb-5 border-b border-slate-200">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-bold">Alerts</Text>
            <View className="flex-row items-center">
              <Text className="text-slate-900 text-3xl font-black mr-3">Activity</Text>
              {unreadCount > 0 && (
                <View className="bg-primary w-6 h-6 rounded-full items-center justify-center shadow-sm">
                  <Text className="text-white text-xs font-bold">{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            className="w-11 h-11 bg-white border border-slate-200 shadow-sm rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-slate-700 font-bold">{user?.email?.[0]?.toUpperCase() || 'U'}</Text>
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
              tintColor="#e11d48"
              colors={['#e11d48']}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-28">
              <View className="w-24 h-24 bg-white border border-slate-200 shadow-sm rounded-full items-center justify-center mb-6">
                <Text className="text-4xl">📭</Text>
              </View>
              <Text className="text-slate-900 text-xl font-bold mb-2">All quiet</Text>
              <Text className="text-slate-500 text-center px-10 leading-6 font-medium">
                When someone scans your lost item{'\n'}or it's detected nearby, it'll appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isScanned = item.type === 'nfc_tap';
            const isUnreadScanned = isScanned && !item.is_read;
            const location = item.metadata?.location_label || 'Unknown location';
            
            const cardContent = (
              <View className="p-5">
                <View className="flex-row items-start mb-3">
                  <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
                    item.metadata?.community_item_id ? 'bg-purple-100 border border-purple-200' :
                    isScanned ? (item.is_read ? 'bg-primary/10 border border-primary/20' : 'bg-white border border-green-200') : 'bg-slate-100 border border-slate-200'
                  }`}>
                    <Text className="text-2xl">
                      {item.metadata?.community_item_id ? '🙋' : isScanned ? '📱' : '📡'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`font-bold text-base mb-0.5 ${item.is_read ? 'text-slate-700' : (isUnreadScanned ? 'text-green-900' : 'text-slate-900')}`}>
                      {item.metadata?.community_item_id ? 'Community Claim Received' :
                       isScanned ? 'Item Scanned by Finder!' : 'Passive Network Sighting'}
                    </Text>
                    <Text className={`text-xs font-medium ${isUnreadScanned ? 'text-green-800' : 'text-slate-500'}`}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {!item.is_read && !isUnreadScanned && (
                    <View className="w-2.5 h-2.5 rounded-full bg-primary mt-1" />
                  )}
                </View>

                {isUnreadScanned ? (
                  <View className="mb-4">
                    <Text className="text-green-900 font-medium mb-2">{item.message}</Text>
                    <View className="bg-white/60 rounded-xl p-3 border border-green-200/50">
                      <Text className="text-green-800 text-xs uppercase font-bold tracking-wider mb-1">Found near</Text>
                      <Text className="text-green-950 font-black text-lg">📍 {location}</Text>
                    </View>
                  </View>
                ) : (
                  <Text className={`leading-6 text-sm ${item.is_read ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
                    {item.message}
                  </Text>
                )}

                {isUnreadScanned ? (
                  <View className="mt-2 bg-indigo-600 rounded-2xl py-4 items-center shadow-md">
                    <Text className="text-white font-black text-base tracking-wide">Chat with Finder Now →</Text>
                  </View>
                ) : (
                  (isScanned || item.metadata?.community_item_id) && (
                    <View className="mt-4 flex-row items-center">
                      <Text className="text-primary font-bold text-xs tracking-wider uppercase">
                        {item.metadata?.community_item_id ? 'Review Proof Answer →' : 'Review & Reply →'}
                      </Text>
                    </View>
                  )
                )}
              </View>
            );

            if (isUnreadScanned) {
              return (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handlePress(item)}
                    className="rounded-3xl mb-4 overflow-hidden shadow-lg border border-green-300"
                  >
                    <LinearGradient colors={['#dcfce7', '#bbf7d0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      {cardContent}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              );
            }

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePress(item)}
                className={`rounded-3xl mb-4 border overflow-hidden shadow-sm ${
                  item.is_read
                    ? 'bg-white border-slate-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {!item.is_read && <View className="h-0.5 bg-primary w-full" />}
                {cardContent}
              </TouchableOpacity>
            );
          }}
        />
      </Animated.View>
    </View>
  );
}
