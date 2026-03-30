import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import EntitlementGate from '../../components/subscription/EntitlementGate';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItem() {
      const { data } = await supabase.from('items').select('*').eq('id', id).single();
      setItem(data);
      setLoading(false);
    }
    fetchItem();
  }, [id]);

  if (loading) return <View className="flex-1 pt-20 items-center"><ActivityIndicator size="large" /></View>;
  if (!item) return <View className="flex-1 pt-20 items-center"><Text className="text-xl">Item not found</Text></View>;

  const hasLocation = item.last_seen_lat && item.last_seen_lng;

  return (
    <View className="flex-1 bg-white p-6">
      <Text className="text-3xl font-bold mb-2 text-gray-900 mt-4">{item.item_name}</Text>
      <View className="flex-row items-center mb-8">
         <View className="bg-gray-100 px-3 py-1 rounded-full mr-2">
            <Text className="text-gray-700 text-sm font-medium">{item.category}</Text>
         </View>
         <View className="bg-primary/10 px-3 py-1 rounded-full">
            <Text className="text-primary text-sm font-bold uppercase">{item.tag_type.replace('_', ' ')}</Text>
         </View>
      </View>

      <Text className="text-xl font-bold mb-4 text-gray-900">Last Known Location</Text>
      
      <EntitlementGate requiredTier="pro" featureName="Passive Tracking Map">
        {hasLocation ? (
          <View className="w-full h-64 bg-gray-200 rounded-2xl overflow-hidden border border-gray-300 relative shadow-sm">
            {/* Simulated MapView */}
            <View className="absolute inset-0 items-center justify-center bg-blue-50/50">
               <Text className="text-5xl mb-2">🗺️</Text>
               <Text className="text-blue-900 font-bold text-lg mb-1">Map View</Text>
               <Text className="text-blue-700 font-medium">Lat: {item.last_seen_lat.toFixed(4)}, Lng: {item.last_seen_lng.toFixed(4)}</Text>
               <Text className="text-gray-500 text-sm mt-4 italic">
                  Last seen: {new Date(item.last_seen_at).toLocaleTimeString()}
               </Text>
            </View>
          </View>
        ) : (
          <View className="w-full h-40 bg-gray-50 rounded-2xl items-center justify-center border border-gray-200 border-dashed">
             <Text className="text-gray-500 font-medium text-lg">No passive location data yet.</Text>
             <Text className="text-gray-400 text-sm mt-1">Wait for a network ping.</Text>
          </View>
        )}
      </EntitlementGate>
    </View>
  );
}
