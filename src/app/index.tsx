import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function ContextSelectionScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const handleSelection = (context: string) => {
    router.replace('/(tabs)/my-items');
  };

  return (
    <View className="flex-1 justify-center items-center bg-white p-6">
      <Text className="text-2xl font-bold mb-8">How will you use the app?</Text>
      
      <TouchableOpacity 
        className="w-full bg-primary p-4 rounded-xl mb-4 items-center"
        onPress={() => handleSelection('university')}
      >
        <Text className="text-white text-lg font-semibold">University Campus</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="w-full bg-secondary p-4 rounded-xl items-center"
        onPress={() => handleSelection('public')}
      >
        <Text className="text-gray-800 text-lg font-semibold">Public & City</Text>
      </TouchableOpacity>
    </View>
  );
}
