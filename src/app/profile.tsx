import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useItemStore } from '../stores/itemStore';
import { PLAN_LIMITS } from '../lib/constants';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const { user, setSession } = useAuthStore();
  const { tier } = useSubscriptionStore();
  const { itemsCount } = useItemStore();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.replace('/login');
  };

  const getTierColor = () => {
    if (tier === 'max') return 'bg-purple-100 text-purple-800';
    if (tier === 'pro') return 'bg-cyan-100 text-cyan-800';
    return 'bg-gray-200 text-gray-800';
  };

  const maxItems = PLAN_LIMITS[tier].maxItems;
  const progressText = maxItems === Infinity ? `${itemsCount} items used` : `${itemsCount} / ${maxItems} items used`;

  return (
    <ScrollView className="flex-1 bg-gray-50 pt-16 px-6">
      <View className="flex-row justify-between items-center mb-8">
         <Text className="text-3xl font-bold text-gray-900 flex-1">Profile</Text>
         <TouchableOpacity onPress={() => router.back()} className="bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
            <Text className="font-bold text-gray-700">Close</Text>
         </TouchableOpacity>
      </View>

      <View className="items-center mb-10">
         <View className="w-28 h-28 bg-teal-50 rounded-full items-center justify-center mb-4 border-4 border-teal-100 shadow-sm pl-2">
            <Text className="text-5xl text-teal-700 font-bold">{user?.email?.[0].toUpperCase() || 'U'}</Text>
         </View>
         <Text className="text-2xl font-bold text-gray-900">{user?.email}</Text>
         <View className={`px-4 py-1.5 rounded-full mt-3 shadow-sm ${getTierColor().split(' ')[0]}`}>
           <Text className={`font-bold uppercase tracking-widest text-xs ${getTierColor().split(' ')[1]}`}>{tier} PLAN</Text>
         </View>
      </View>

      <View className="bg-white rounded-3xl p-6 mb-6 shadow-sm border border-gray-100">
         <Text className="text-gray-900 font-bold text-lg mb-2">Plan Usage</Text>
         <Text className="text-gray-500 mb-6 font-medium">{progressText}</Text>
         {tier !== 'max' && (
            <TouchableOpacity onPress={() => router.push('/subscription')} className="bg-teal-50 p-4 rounded-xl items-center border border-teal-200 shadow-[0_2px_8px_rgba(13,148,136,0.15)]">
               <Text className="text-teal-700 font-bold tracking-wide">Upgrade Plan →</Text>
            </TouchableOpacity>
         )}
      </View>

      <View className="bg-white rounded-3xl p-6 mb-10 shadow-sm border border-gray-100">
         <Text className="text-gray-900 font-bold text-lg mb-6">Device Capabilities</Text>
         
         <View className="flex-row justify-between items-center mb-6">
            <Text className="text-gray-700 font-bold">NFC Support</Text>
            <View className="bg-green-50 border border-green-200 px-3 py-1.5 rounded-full flex-row items-center">
               <View className="w-2 h-2 rounded-full bg-green-500 mr-2 shadow-sm" />
               <Text className="text-green-700 text-xs font-bold tracking-wider">READY</Text>
            </View>
         </View>

         <View className="flex-row justify-between items-center">
            <Text className="text-gray-700 font-bold">BLE Relay Network</Text>
            {tier === 'pro' || tier === 'max' ? (
               <View className="bg-green-50 border border-green-200 px-3 py-1.5 rounded-full flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-green-500 mr-2 shadow-sm" />
                  <Text className="text-green-700 text-xs font-bold tracking-wider">CONTRIBUTING</Text>
               </View>
            ) : (
               <View className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-full flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-red-500 mr-2 shadow-sm" />
                  <Text className="text-red-700 text-xs font-bold tracking-wider">INACTIVE</Text>
               </View>
            )}
         </View>
      </View>

      <TouchableOpacity onPress={handleLogout} className="bg-red-50 p-4 rounded-xl items-center border border-red-200 mb-12 shadow-[0_2px_8px_rgba(239,68,68,0.1)]">
         <Text className="text-red-600 font-bold text-lg tracking-wide">Log Out</Text>
      </TouchableOpacity>

      <Text className="text-center text-gray-400 font-medium mb-12">Lost & Found Network v1.0.0</Text>
    </ScrollView>
  );
}
