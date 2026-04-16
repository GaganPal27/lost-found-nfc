import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useItemStore } from '../../stores/itemStore';
import { useAuthStore } from '../../stores/authStore';

const CATEGORIES = ['Personal', 'Electronics', 'Bag', 'Keys', 'Wallet', 'Travel', 'Other'];

export default function EditItemScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { fetchMyItems } = useItemStore();
  const { user } = useAuthStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadItem() {
      const { data, error } = await supabase.from('items').select('*').eq('id', id).single();
      if (!error && data) {
        setName(data.item_name || '');
        setCategory(data.category || 'Personal');
        setColor(data.color || '');
        setDescription(data.description || '');
      } else {
        Alert.alert('Error', 'Could not load item details.');
        router.back();
      }
      setLoadingInitial(false);
    }
    loadItem();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Item name is required');
    
    setSaving(true);
    const { error } = await supabase.from('items').update({
      item_name: name.trim(),
      category,
      color: color.trim(),
      description: description.trim(),
    }).eq('id', id);

    setSaving(false);

    if (error) {
      Alert.alert('Update Failed', error.message);
    } else {
      if (user?.id) await fetchMyItems(user.id);
      router.back();
    }
  };

  if (loadingInitial) {
    return (
      <View className="flex-1 bg-darkBg justify-center items-center">
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Cancel</Text>
        </TouchableOpacity>

        <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">Manage</Text>
        <Text className="text-white text-3xl font-bold mb-8">Edit Item</Text>

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
        <View className="mb-8">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Description / Details</Text>
          <View className="bg-darkCard border border-darkBorder rounded-2xl px-4">
            <TextInput
              className="text-white py-4 text-base"
              placeholder="Distinguishing features, damage, marks..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{ minHeight: 100 }}
            />
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          className={`w-full bg-primary py-4 rounded-2xl items-center ${saving ? 'opacity-60' : ''}`}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
        >
          {saving
            ? <ActivityIndicator color="#0f172a" />
            : <Text className="text-slate-900 font-bold text-lg tracking-wide">Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
