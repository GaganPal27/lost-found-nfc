import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Location from 'expo-location';

type PublicItem = {
  item_name: string;
  category: string;
  color: string;
  image_url: string;
  user_id: string;
};

export default function PublicItemPage() {
  const { nfc_uid } = useLocalSearchParams();
  const [item, setItem] = useState<PublicItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    async function loadItem() {
      const { data, error } = await supabase
        .from('items')
        .select('item_name, category, color, image_url, user_id')
        .eq('nfc_uid', nfc_uid as string)
        .neq('status', 'deleted')
        .single();

      if (data) setItem(data as PublicItem);
      setLoading(false);
    }
    loadItem();
  }, [nfc_uid]);

  const handleShareLocation = async () => {
    if (!item) return;
    setSharing(true);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need location permission to help return the item.');
        setSharing(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      let geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      const areaLabel = geocode[0] ? `${geocode[0].city || geocode[0].region}` : 'Unknown area';

      await supabase.from('nfc_scans').insert({
        nfc_uid: nfc_uid as string,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        location_label: areaLabel
      });

      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'nfc_tap',
        message: `Someone found your ${item.item_name} near ${areaLabel}`,
        metadata: {
           item_name: item.item_name,
           location: { lat: location.coords.latitude, lng: location.coords.longitude, accuracy: location.coords.accuracy },
           scanned_at: new Date().toISOString(),
           location_label: `Near ${areaLabel}`
        }
      });

      setShared(true);
      Alert.alert('Owner notified', 'Thank you! The owner has received your location.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSharing(false);
    }
  };

  if (loading) return <View className="flex-1 justify-center items-center bg-gray-50"><ActivityIndicator size="large" /></View>;
  if (!item) return <View className="flex-1 justify-center items-center p-6 bg-gray-50"><Text className="text-xl font-bold text-gray-800">Item not found</Text></View>;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
       <View className="items-center mt-8 mb-6">
         <View className="w-32 h-32 bg-gray-200 rounded-full overflow-hidden mb-4 border-4 border-white shadow-sm">
           {item.image_url ? (
             <Image source={{ uri: item.image_url }} className="w-full h-full" />
           ) : (
             <View className="w-full h-full items-center justify-center bg-gray-300">
               <Text className="text-4xl">🎒</Text>
             </View>
           )}
         </View>
         <Text className="text-3xl font-bold text-gray-900">{item.item_name}</Text>
         <Text className="text-lg text-gray-500 mt-1 capitalize">{item.color} • {item.category}</Text>
       </View>

       <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-4">
         <Text className="text-xl font-bold text-gray-900 mb-2 text-center">You found someone's lost item</Text>
         <Text className="text-center text-gray-600 mb-6 font-medium">
           Please help return it to its owner by sharing your approximate location.
         </Text>

         {!shared ? (
           <TouchableOpacity
             className={`w-full bg-primary p-4 rounded-xl items-center flex-row justify-center ${sharing ? 'opacity-70' : ''}`}
             onPress={handleShareLocation} disabled={sharing}
           >
             {sharing && <ActivityIndicator color="#fff" className="mr-2" />}
             <Text className="text-white font-bold text-lg tracking-wide">Help return it — share your area</Text>
           </TouchableOpacity>
         ) : (
           <View className="w-full bg-green-50 p-4 rounded-xl items-center border border-green-200">
             <Text className="text-green-700 font-bold text-lg">✅ Owner notified — thank you!</Text>
           </View>
         )}

         <Text className="text-center text-gray-400 mt-4 text-sm font-medium">
           Only your approximate area is shared with the owner.
         </Text>
       </View>
    </ScrollView>
  );
}
