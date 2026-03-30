import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import TagTypeSelector from '../../components/TagTypeSelector';
import EntitlementGate from '../../components/subscription/EntitlementGate';
import { PLAN_LIMITS } from '../../lib/constants';

type TagType = 'nfc_only' | 'nfc_ble' | 'ble_only';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function RegisterItemScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { itemsCount, fetchCount } = useItemStore();
  const { tier } = useSubscriptionStore();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Personal');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [tagType, setTagType] = useState<TagType>('nfc_only');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState({ tier: 'pro', feature: '' });

  useEffect(() => {
    if (user?.id) fetchCount(user.id);
  }, [user]);

  const limitReached = itemsCount >= PLAN_LIMITS[tier].maxItems;

  const pickImage = async () => {
    // Simulated image picker due to peer dependency issues
    setImageUri("https://via.placeholder.com/300");
  };

  const handleRegister = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Item name is required');
    if (limitReached) return setShowUpgrade(true);

    try {
      setLoading(true);

      const nfc_uid = tagType !== 'ble_only' ? generateUUID() : null;
      const ble_beacon_id = tagType !== 'nfc_only' ? `LF-BLE-${generateUUID().slice(0,6)}` : null;

      const { data, error } = await supabase.from('items').insert({
        user_id: user?.id,
        item_name: name,
        category,
        color,
        description,
        image_url: imageUri,
        nfc_uid,
        ble_beacon_id,
        tag_type: tagType,
        status: 'active'
      }).select().single();

      if (error) throw error;

      router.push({
        pathname: '/register-item/write-tag',
        params: { 
          id: data.id,
          nfc_uid: nfc_uid || '',
          ble_beacon_id: ble_beacon_id || '',
          tag_type: tagType
        }
      });
      
    } catch (e: any) {
      Alert.alert('Error saving item', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLockedSelect = (requiredTier: string) => {
    setUpgradeReason({ tier: requiredTier as 'pro'|'max', feature: 'Premium Tag Types' });
    setShowUpgrade(true);
  };

  if (limitReached || showUpgrade) {
    const rTier = showUpgrade ? upgradeReason.tier : 'pro';
    const rFeat = showUpgrade ? upgradeReason.feature : 'Add more items';
    return (
      <View className="flex-1 justify-center p-6 bg-white">
        <EntitlementGate requiredTier={rTier as any} featureName={rFeat}>
           <Text>Hidden Content</Text>
        </EntitlementGate>
        <TouchableOpacity className="mt-4" onPress={() => showUpgrade ? setShowUpgrade(false) : router.back()}>
          <Text className="text-center text-gray-500 font-bold p-4 text-lg">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
      <Text className="text-3xl font-bold mb-6 text-gray-900 mt-8">Register Item</Text>

      <TouchableOpacity onPress={pickImage} className="w-full h-40 bg-gray-100 rounded-xl mb-6 items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden">
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="w-full h-full" />
        ) : (
          <Text className="text-gray-500 font-medium">Tap to add photo</Text>
        )}
      </TouchableOpacity>

      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Item Name *</Text>
        <TextInput
          className="bg-gray-50 p-4 rounded-xl border border-gray-200"
          value={name} onChangeText={setName} placeholder="e.g. My Black Backpack"
        />
      </View>

      <View className="mb-6">
        <Text className="text-gray-700 font-semibold mb-2">Description</Text>
        <TextInput
          className="bg-gray-50 p-4 rounded-xl border border-gray-200"
          value={description} onChangeText={setDescription} placeholder="Small zipper is broken..."
        />
      </View>

      <TagTypeSelector 
        selectedType={tagType} 
        onSelect={setTagType} 
        onLockedSelect={handleLockedSelect} 
      />

      <TouchableOpacity
        className={`w-full bg-primary p-4 rounded-xl items-center mt-4 ${loading ? 'opacity-70' : ''}`}
        onPress={handleRegister} disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold tracking-wide text-lg">Continue to Setup Tag</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
