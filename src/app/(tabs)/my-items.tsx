import { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { PLAN_LIMITS } from '../../lib/constants';
import ItemCard from '../../components/ItemCard';

export default function MyItemsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, itemsCount, fetchMyItems, subscribeToItems, unsubscribeFromItems } = useItemStore();
  const { tier } = useSubscriptionStore();
  const [refreshing, setRefreshing] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    if (user?.id) {
      fetchMyItems(user.id);
      subscribeToItems(user.id);
    }
    return () => unsubscribeFromItems();
  }, [user]);

  const limit = PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS].maxItems;
  const isAtLimit = itemsCount >= limit;

  const handleRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    await fetchMyItems(user.id);
    setRefreshing(false);
  };

  const handleAdd = () => router.push('/register-item');

  const usedPct = limit === Infinity ? 0 : Math.min((itemsCount / limit) * 100, 100);

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="px-6 pt-14 pb-5 border-b border-darkBorder">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-slate-400 text-xs uppercase tracking-widest mb-1">My Items</Text>
            <Text className="text-white text-3xl font-bold">Protected Items</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            className="w-11 h-11 bg-darkCard border border-darkBorder rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-white font-bold text-base">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plan banner */}
        {tier !== 'max' && (
          <Animated.View style={{ opacity: fadeIn }}>
            <View className="bg-darkCard border border-darkBorder rounded-2xl p-4 mt-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-slate-300 font-semibold text-sm">
                  {itemsCount} / {limit === Infinity ? '∞' : limit} items used
                </Text>
                <TouchableOpacity onPress={() => router.push('/subscription')} activeOpacity={0.7}>
                  <View className="bg-primary/15 border border-primary/30 px-3 py-1 rounded-full">
                    <Text className="text-primary text-xs font-bold uppercase tracking-wider">⬆ Upgrade</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <View className="h-full bg-primary rounded-full" style={{ width: `${usedPct}%` }} />
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#06b6d4"
            colors={['#06b6d4']}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-24 mt-4">
            <View className="w-24 h-24 bg-darkCard border border-darkBorder rounded-full items-center justify-center mb-6">
              <Text className="text-4xl">🎒</Text>
            </View>
            <Text className="text-white text-xl font-bold mb-2">No items yet</Text>
            <Text className="text-slate-400 text-center px-10 leading-6 mb-8">
              Add your first item and let the{'\n'}Lost & Found Network protect it.
            </Text>
            <TouchableOpacity
              className="bg-primary px-8 py-4 rounded-2xl"
              onPress={handleAdd}
              activeOpacity={0.85}
            >
              <Text className="text-slate-900 font-bold tracking-wide text-base">+ Add First Item</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB */}
      {items.length > 0 && (
        <TouchableOpacity
          className="absolute bottom-8 right-6 bg-primary w-16 h-16 rounded-full items-center justify-center"
          style={{ shadowColor: '#06b6d4', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
          onPress={handleAdd}
          activeOpacity={0.85}
        >
          <Text className="text-slate-900 text-3xl font-bold" style={{ lineHeight: 36 }}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
