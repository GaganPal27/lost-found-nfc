import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '../stores/itemStore';

export default function ItemCard({ item }: { item: Item }) {
  const router = useRouter();

  const getStatusColor = () => {
    if (item.status === 'lost') return 'bg-red-100 text-red-800';
    if (item.status === 'found') return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/item-detail/${item.id}`)}
      className="bg-white rounded-2xl mb-4 p-4 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex-row"
    >
      <View className="w-16 h-16 bg-gray-100 rounded-xl mr-4 overflow-hidden items-center justify-center border border-gray-200">
        {item.image_url ? (
           <Image source={{ uri: item.image_url }} className="w-full h-full" />
        ) : <Text className="text-3xl">🎒</Text>}
      </View>
      
      <View className="flex-1 justify-center">
         <View className="flex-row justify-between items-start mb-1">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{item.item_name}</Text>
            <View className={`px-2 py-1 rounded-full ${getStatusColor()}`}>
               <Text className="text-[10px] font-bold uppercase">{item.status}</Text>
            </View>
         </View>
         <View className="flex-row items-center mt-1">
            <Text className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded mr-2 uppercase tracking-wider">
               {item.tag_type.replace('_', ' ')}
            </Text>
            <Text className="text-xs text-gray-400 capitalize">{item.category}</Text>
         </View>
         {item.last_seen_at && (
           <Text className="text-xs text-gray-400 mt-2">
              Last seen: {new Date(item.last_seen_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
           </Text>
         )}
      </View>
    </TouchableOpacity>
  );
}
