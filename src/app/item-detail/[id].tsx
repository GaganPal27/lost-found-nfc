import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import EntitlementGate from '../../components/subscription/EntitlementGate';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { deleteItem, updateStatus } = useItemStore();
  const { tier } = useSubscriptionStore();
  
  const [item, setItem] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('active');

  useEffect(() => {
    async function loadData() {
      const { data: itemData } = await supabase.from('items').select('*').eq('id', id).single();
      if (itemData) {
        setItem(itemData);
        setStatus(itemData.status);
        
        const days = tier === 'max' ? 90 : tier === 'pro' ? 30 : 7;
        const d = new Date();
        d.setDate(d.getDate() - days);

        const { data: scanData } = await supabase
          .from('nfc_scans')
          .select('*')
          .eq('nfc_uid', itemData.nfc_uid)
          .gte('scanned_at', d.toISOString())
          .order('scanned_at', { ascending: false });
          
        setScans(scanData || []);
      }
      setLoading(false);
    }
    loadData();
  }, [id, tier]);

  const handleUpdateStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await updateStatus(id as string, newStatus as any);
  };

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure you want to remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteItem(id as string);
          router.replace('/(tabs)/my-items');
      }}
    ]);
  };

  const handleRewrite = () => {
    router.push({
      pathname: '/register-item/write-tag',
      params: { 
        id: item.id,
        nfc_uid: item.nfc_uid,
        ble_beacon_id: item.ble_beacon_id || '',
        tag_type: item.tag_type
      }
    });
  };

  if (loading) return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" /></View>;
  if (!item) return <View className="flex-1 justify-center items-center"><Text>Item not found</Text></View>;

  const hasLocation = item.last_seen_lat && item.last_seen_lng;

  return (
    <ScrollView className="flex-1 bg-gray-50 p-6">
      <View className="flex-row justify-between items-start mt-4 mb-2">
         <Text className="text-3xl font-bold text-gray-900 flex-1 mr-4">{item.item_name}</Text>
         <TouchableOpacity onPress={handleDelete} className="bg-red-50 p-2 rounded-full border border-red-100">
            <Text className="text-red-500 font-bold px-3">Delete</Text>
         </TouchableOpacity>
      </View>
      
      <View className="flex-row items-center mb-6">
         <View className="bg-gray-200 px-3 py-1 rounded-full mr-2">
            <Text className="text-gray-700 text-sm font-medium">{item.category}</Text>
         </View>
         <View className="bg-primary/10 px-3 py-1 rounded-full">
            <Text className="text-primary text-sm font-bold uppercase tracking-wider">{item.tag_type.replace('_', ' ')}</Text>
         </View>
      </View>

      <View className="bg-white p-4 rounded-2xl mb-6 shadow-sm border border-gray-100 flex-row justify-between items-center">
         <View className="flex-1 pr-4">
            <Text className="text-gray-900 font-bold text-lg mb-1">Lost Mode</Text>
            <Text className="text-gray-500 text-sm">When enabled, anyone scanning will see your contact details if shared.</Text>
         </View>
         <Switch 
            value={status === 'lost'} 
            onValueChange={(v) => handleUpdateStatus(v ? 'lost' : 'active')} 
            trackColor={{ true: '#ef4444' }} 
         />
      </View>

      <Text className="text-xl font-bold mb-4 text-gray-900">Passive Tracking Map</Text>
      <EntitlementGate requiredTier="pro" featureName="Passive Tracking Map">
        {hasLocation ? (
          <View className="w-full h-48 bg-gray-200 rounded-2xl mb-8 overflow-hidden border border-gray-300 relative shadow-sm">
            <View className="absolute inset-0 items-center justify-center bg-blue-50/50">
               <Text className="text-4xl mb-2">🗺️</Text>
               <Text className="text-blue-900 font-bold text-lg mb-1">Map View</Text>
               <Text className="text-blue-700 font-medium">Lat: {item.last_seen_lat.toFixed(4)}, Lng: {item.last_seen_lng.toFixed(4)}</Text>
               <Text className="text-gray-500 text-sm mt-2 italic">
                  Last seen: {new Date(item.last_seen_at).toLocaleTimeString()}
               </Text>
            </View>
          </View>
        ) : (
          <View className="w-full h-32 bg-gray-50 rounded-2xl mb-8 items-center justify-center border border-gray-200 border-dashed">
             <Text className="text-gray-500 font-medium">No passive location data yet.</Text>
          </View>
        )}
      </EntitlementGate>

      <Text className="text-xl font-bold mb-4 text-gray-900 mt-4">NFC Scan History</Text>
      <View className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
         {scans.length === 0 ? (
            <View className="p-6 items-center">
               <Text className="text-gray-400">No recent scans found.</Text>
            </View>
         ) : (
            scans.map((scan, i) => (
               <View key={scan.id} className={`p-4 flex-row items-center ${i !== scans.length -1 ? 'border-b border-gray-100' : ''}`}>
                  <Text className="text-2xl mr-4">📍</Text>
                  <View className="flex-1">
                     <Text className="text-gray-900 font-bold">{scan.location_label}</Text>
                     <Text className="text-gray-500 text-sm">{new Date(scan.scanned_at).toLocaleString()}</Text>
                  </View>
               </View>
            ))
         )}
         {scans.length > 0 && tier === 'basic' && (
            <View className="bg-orange-50 p-3 items-center border-t border-orange-100">
               <Text className="text-orange-600 text-xs font-bold uppercase tracking-widest text-center">Showing last 7 days. Upgrade for 30 days history.</Text>
            </View>
         )}
      </View>

      <TouchableOpacity onPress={handleRewrite} className="bg-secondary p-4 rounded-xl items-center border border-primary/20 mb-12 shadow-sm">
         <Text className="text-primary font-bold text-lg tracking-wide">Re-program Tag</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
