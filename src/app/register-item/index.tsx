import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, StatusBar } from 'react-native';
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

const CATEGORIES = ['Personal', 'Electronics', 'Bag', 'Keys', 'Wallet', 'Travel', 'Other'];

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
    setImageUri('https://via.placeholder.com/300');
  };

  const handleRegister = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Item name is required');
    if (limitReached) return setShowUpgrade(true);

    try {
      setLoading(true);
      const nfc_uid = tagType !== 'ble_only' ? generateUUID() : null;
      const ble_beacon_id = tagType !== 'nfc_only' ? `LF-BLE-${generateUUID().slice(0, 6).toUpperCase()}` : null;

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
        status: 'active',
      }).select().single();

      if (error) throw error;

      if (tagType === 'nfc_ble') {
        router.push({ pathname: '/nfc-ble-setup', params: { id: data.id, nfc_uid: nfc_uid || '', ble_beacon_id: ble_beacon_id || '' } });
      } else {
        router.push({
          pathname: '/register-item/write-tag',
          params: { id: data.id, nfc_uid: nfc_uid || '', ble_beacon_id: ble_beacon_id || '', tag_type: tagType },
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLockedSelect = (requiredTier: string) => {
    setUpgradeReason({ tier: requiredTier as 'pro' | 'max', feature: 'Premium Tag Types' });
    setShowUpgrade(true);
  };

  if (limitReached || showUpgrade) {
    const rTier = showUpgrade ? upgradeReason.tier : 'pro';
    const rFeat = showUpgrade ? upgradeReason.feature : 'Add more items';
    return (
      <View className="flex-1 justify-center p-6 bg-darkBg">
        <EntitlementGate requiredTier={rTier as any} featureName={rFeat}>
          <Text className="text-white">Hidden</Text>
        </EntitlementGate>
        <TouchableOpacity className="mt-4" onPress={() => showUpgrade ? setShowUpgrade(false) : router.back()}>
          <Text className="text-center text-slate-400 font-bold p-4 text-lg">← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">My Items</Text>
        </TouchableOpacity>

        <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">New Item</Text>
        <Text className="text-white text-3xl font-bold mb-8">Register Item</Text>

        {/* Image Picker */}
        <TouchableOpacity
          onPress={pickImage}
          className="w-full h-44 bg-darkCard border-2 border-dashed border-darkBorder rounded-3xl mb-6 items-center justify-center overflow-hidden"
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} className="w-full h-full" />
          ) : (
            <View className="items-center">
              <Text className="text-4xl mb-2">📷</Text>
              <Text className="text-slate-400 font-medium">Tap to add photo</Text>
              <Text className="text-slate-600 text-xs mt-1">Optional but recommended</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Item Name */}
        <View className="mb-5">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Item Name *</Text>
          <View className="bg-darkCard border border-darkBorder rounded-2xl px-4 flex-row items-center">
            <TextInput
              className="flex-1 text-white py-4 text-base"
              placeholder="e.g. Black Leather Wallet"
              placeholderTextColor="#475569"
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* Category */}
        <View className="mb-5">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-semibold">Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-full border ${
                    category === cat
                      ? 'bg-primary/20 border-primary/50'
                      : 'bg-darkCard border-darkBorder'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-semibold text-sm ${category === cat ? 'text-primary' : 'text-slate-400'}`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Color */}
        <View className="mb-5">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Color</Text>
          <View className="bg-darkCard border border-darkBorder rounded-2xl px-4">
            <TextInput
              className="text-white py-4 text-base"
              placeholder="e.g. Black, Blue, Silver..."
              placeholderTextColor="#475569"
              value={color}
              onChangeText={setColor}
            />
          </View>
        </View>

        {/* Description */}
        <View className="mb-6">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Description</Text>
          <View className="bg-darkCard border border-darkBorder rounded-2xl px-4">
            <TextInput
              className="text-white py-4 text-base"
              placeholder="Distinguishing features, damage, marks..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>
        </View>

        {/* Tag Type */}
        <TagTypeSelector
          selectedType={tagType}
          onSelect={setTagType}
          onLockedSelect={handleLockedSelect}
        />

        {/* Submit */}
        <TouchableOpacity
          className={`w-full bg-primary py-4 rounded-2xl items-center mt-6 ${loading ? 'opacity-60' : ''}`}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
          style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
        >
          {loading
            ? <ActivityIndicator color="#0f172a" />
            : <Text className="text-slate-900 font-bold text-lg tracking-wide">Continue to Setup Tag →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
