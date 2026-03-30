import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { writeNDEFUrl } from '../../lib/nfc';

export default function WriteTagScreen() {
  const { nfc_uid, ble_beacon_id, tag_type } = useLocalSearchParams();
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Cast properly from expo router query
  const tagType = String(tag_type);
  const nfcUid = String(nfc_uid);
  const beaconId = String(ble_beacon_id);

  const isNFC = tagType === 'nfc_only' || tagType === 'nfc_ble';
  const isBLE = tagType === 'ble_only' || tagType === 'nfc_ble';

  useEffect(() => {
    if (success && !isBLE) {
      setTimeout(() => {
        router.replace('/(tabs)/my-items');
      }, 3000);
    }
  }, [success]);

  const handleWriteNFC = async () => {
    setWriting(true);
    const url = `https://lostandfound.app/item/${nfcUid}`;
    const wroteParams = await writeNDEFUrl(url);
    setWriting(false);
    
    if (wroteParams) {
      Alert.alert('Success', 'Tag programmed! Stick it on your item.');
      setSuccess(true);
    } else {
      Alert.alert('Error', 'Failed to write to NFC tag. Please try again.');
    }
  };

  const copyBeaconId = async () => {
    Alert.alert('Copied!', 'Beacon ID is ready to use');
    setTimeout(() => {
      router.replace('/(tabs)/my-items');
    }, 1500);
  };

  return (
    <View className="flex-1 items-center justify-center p-6 bg-white">
      <Text className="text-3xl font-bold mb-8 text-gray-900 text-center">Setup your Tag</Text>

      {isNFC && !success && (
        <View className="items-center w-full mb-8">
          <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-6 border-4 border-primary">
            <Text className="text-4xl">📱</Text>
          </View>
          <Text className="text-xl text-center text-gray-700 mb-6 font-semibold">
            Hold your phone against the NFC tag to program it.
          </Text>
          <TouchableOpacity
            className={`w-full bg-primary p-4 rounded-xl items-center ${writing ? 'opacity-70' : ''}`}
            onPress={handleWriteNFC}
            disabled={writing}
          >
            {writing ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Start NFC Write</Text>}
          </TouchableOpacity>
        </View>
      )}

      {isBLE && (!isNFC || success) && (
        <View className="items-center w-full mt-4 p-6 bg-gray-50 rounded-2xl border border-gray-200">
          <Text className="text-xl font-bold text-gray-900 mb-2">Configure BLE Beacon</Text>
          <Text className="text-center text-gray-600 mb-4 font-semibold">
            Use your beacon's companion app to set its identifier name to:
          </Text>
          
          <View className="bg-white p-4 rounded-lg border border-gray-300 w-full mb-4 items-center">
            <Text className="text-2xl font-mono text-gray-800 font-bold tracking-wider">{beaconId}</Text>
          </View>

          <TouchableOpacity
            className="w-full bg-secondary p-4 rounded-xl items-center"
            onPress={copyBeaconId}
          >
            <Text className="text-gray-900 font-bold text-lg">Copy ID & Complete</Text>
          </TouchableOpacity>
        </View>
      )}

      {success && !isBLE && (
        <View className="items-center mt-12 bg-green-50 p-8 rounded-full">
          <Text className="text-5xl mb-4">✅</Text>
          <Text className="text-2xl font-bold text-green-600">All Done!</Text>
        </View>
      )}
      
      {/* Dev skip button */}
      <TouchableOpacity className="mt-12 bg-gray-200 p-3 rounded-lg" onPress={() => router.replace('/(tabs)/my-items')}>
         <Text className="text-gray-500 font-bold">Skip (Dev)</Text>
      </TouchableOpacity>
    </View>
  );
}
