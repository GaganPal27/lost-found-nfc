import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
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

  useEffect(() => {
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

  const handleAdd = () => {
    router.push('/register-item');
  };

  return (
    <View className="flex-1 bg-gray-50">
       <View className="px-6 pt-12 pb-4 bg-white border-b border-gray-100">
         <Text className="text-3xl font-bold text-gray-900 mt-4">My Items</Text>
       </View>

       {tier !== 'max' && (
         <View className="bg-teal-50 p-4 mx-4 mt-4 rounded-xl flex-row justify-between items-center border border-teal-100 shadow-sm">
           <Text className="text-teal-800 font-medium">
             {itemsCount} of {limit === Infinity ? 'Unlimited' : limit} items used ({tier} plan)
           </Text>
           <TouchableOpacity onPress={() => router.push('/subscription')} className="bg-teal-600 px-3 py-1.5 rounded-full">
             <Text className="text-white font-bold text-xs">Upgrade</Text>
           </TouchableOpacity>
         </View>
       )}

       <FlatList
         data={items}
         keyExtractor={(item) => item.id}
         renderItem={({ item }) => <ItemCard item={item} />}
         contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
         ListEmptyComponent={
           <View className="items-center justify-center py-20 mt-12">
             <Text className="text-6xl mb-4">🎒</Text>
             <Text className="text-gray-500 text-xl font-bold">No items registered yet</Text>
             <Text className="text-gray-400 mt-2 mb-8 text-center px-8">Add your first item and secure your belongings.</Text>
             <TouchableOpacity className="bg-primary px-8 py-4 rounded-full shadow-md" onPress={handleAdd}>
                <Text className="text-white font-bold tracking-wide">Add First Item</Text>
             </TouchableOpacity>
           </View>
         }
       />

       {items.length > 0 && (
         <TouchableOpacity
           className="absolute bottom-6 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-lg elevation-5"
           onPress={handleAdd}
         >
           <Text className="text-white text-4xl pb-1" style={{lineHeight: 40}}>+</Text>
         </TouchableOpacity>
       )}
    </View>
  );
}
