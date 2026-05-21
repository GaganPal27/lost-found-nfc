import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView, StatusBar } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Location from 'expo-location';

type PublicItem = {
  item_name: string;
  category: string;
  color: string;
  image_url: string;
  user_id: string;
  status: string;
};

export default function PublicItemPage() {
  const { nfc_uid } = useLocalSearchParams();
  const [item, setItem] = useState<PublicItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    async function loadItem() {
      const { data } = await supabase
        .from('items')
        .select('item_name, category, color, image_url, user_id, status')
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to help return this item.');
        setSharing(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const areaLabel = geocode[0] ? `${geocode[0].city || geocode[0].region}` : 'Unknown area';

      await supabase.from('nfc_scans').insert({
        nfc_uid: nfc_uid as string,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        location_label: areaLabel,
      });

      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'nfc_tap',
        message: `Someone found your ${item.item_name} near ${areaLabel}`,
        metadata: {
          item_name: item.item_name,
          location: { lat: location.coords.latitude, lng: location.coords.longitude },
          scanned_at: new Date().toISOString(),
          location_label: `Near ${areaLabel}`,
        },
      });

      setShared(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSharing(false);
    }
  };

  if (loading) return (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <ActivityIndicator size="large" color="#e11d48" />
    </View>
  );

  if (!item) return (
    <View className="flex-1 justify-center items-center p-6 bg-slate-50">
      <Text className="text-4xl mb-4">🔍</Text>
      <Text className="text-slate-900 text-xl font-bold text-center">Item not found</Text>
      <Text className="text-slate-500 text-center mt-2 font-medium">This tag is not registered in the Lost & Found Network.</Text>
    </View>
  );

  const isLost = item.status === 'lost';

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60, paddingTop: 60 }}>

        {/* Lost Banner */}
        {isLost && (
          <View className="bg-red-50 border border-red-200 rounded-3xl p-4 mb-6 flex-row items-center shadow-sm">
            <Text className="text-2xl mr-3">🚨</Text>
            <View>
              <Text className="text-red-700 font-bold text-base">This item is reported LOST</Text>
              <Text className="text-slate-600 text-sm font-medium">The owner is actively looking for it</Text>
            </View>
          </View>
        )}

        {/* Item Card */}
        <View className="items-center mb-8">
          <View
            className="w-32 h-32 bg-white rounded-3xl overflow-hidden border-2 border-slate-200 mb-5 items-center justify-center shadow-sm"
            style={{ shadowColor: '#e11d48', shadowOpacity: 0.1, shadowRadius: 16, elevation: 5 }}
          >
            {item.image_url && !item.image_url.includes('placeholder') ? (
              <Image source={{ uri: item.image_url }} className="w-full h-full" />
            ) : (
              <Text className="text-5xl">🎒</Text>
            )}
          </View>
          <Text className="text-slate-900 text-3xl font-black text-center mb-1">{item.item_name}</Text>
          <Text className="text-slate-500 text-base capitalize font-medium">
            {[item.color, item.category].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Network Badge */}
        <View className="bg-white border border-slate-200 rounded-3xl p-4 mb-5 flex-row items-center shadow-sm">
          <Text className="text-2xl mr-3">🛡️</Text>
          <View>
            <Text className="text-slate-900 font-bold text-sm">Lost & Found Network</Text>
            <Text className="text-slate-500 text-xs font-medium">Powered by NFC tag technology</Text>
          </View>
          <View className="ml-auto bg-primary/10 border border-primary/20 px-3 py-1 rounded-full shadow-sm">
            <Text className="text-primary text-xs font-bold">VERIFIED</Text>
          </View>
        </View>

        {/* Main CTA */}
        <View className="bg-white border border-slate-200 rounded-3xl p-6 mb-6 shadow-sm">
          <Text className="text-slate-900 text-xl font-bold text-center mb-2">You found someone's {isLost ? 'lost ' : ''}item</Text>
          <Text className="text-slate-500 text-center text-sm leading-6 mb-6 font-medium">
            Help return it by sharing your approximate area with the owner.{'\n'}Only your general area is shared — never your exact address.
          </Text>

          {!shared ? (
            <TouchableOpacity
              className={`w-full bg-primary py-4 rounded-2xl items-center flex-row justify-center shadow-md shadow-primary/30 ${sharing ? 'opacity-60' : ''}`}
              onPress={handleShareLocation}
              disabled={sharing}
              activeOpacity={0.85}
            >
              {sharing && <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />}
              <Text className="text-white font-bold text-lg tracking-wide">
                {sharing ? 'Notifying owner...' : '📍 Help Return — Share My Area'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="w-full bg-green-50 border border-green-200 py-4 rounded-2xl items-center shadow-sm">
              <Text className="text-green-700 font-bold text-lg">✅ Owner Notified — Thank you!</Text>
              <Text className="text-slate-600 text-sm mt-1 font-medium">The owner has received your location.</Text>
            </View>
          )}

          <Text className="text-center text-slate-400 mt-4 text-xs font-medium">
            Your privacy is protected. No personal data is collected.
          </Text>
        </View>

        {/* Footer */}
        <Text className="text-slate-700 text-center text-xs">Lost & Found Network · Powered by NFC</Text>
      </ScrollView>
    </View>
  );
}
