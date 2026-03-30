import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { readNDEFUrl } from '../../lib/nfc';
import { supabase } from '../../lib/supabase';

export default function ScanScreen() {
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  const handleScan = async () => {
    setScanning(true);
    try {
      const url = await readNDEFUrl();
      if (!url) {
        Alert.alert('Scan failed', 'Could not read NFC tag. Please try again.');
        return;
      }
      
      const match = url.match(/\/item\/([a-zA-Z0-9-]+)/);
      if (!match || !match[1]) {
        Alert.alert('Invalid tag', 'This tag is not part of the Lost & Found Network.');
        return;
      }

      const nfcUid = match[1];

      const { data, error } = await supabase
        .from('items')
        .select('id')
        .eq('nfc_uid', nfcUid)
        .neq('status', 'deleted')
        .single();

      if (error || !data) {
        Alert.alert('Not Found', 'This item isn\'t registered in our network yet');
        return;
      }

      router.push(`/item/${nfcUid}`);
    } catch (error) {
       Alert.alert('Error', 'An error occurred during scanning.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <View className="flex-1 bg-white items-center justify-center p-6">
      <View className="w-32 h-32 bg-blue-50 rounded-full items-center justify-center mb-8 border-4 border-blue-200">
         <Text className="text-5xl">📡</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">Found an item?</Text>
      <Text className="text-gray-500 text-center mb-10 px-4 text-lg">
        Tap your phone on the Lost & Found NFC tag to notify the owner.
      </Text>

      <TouchableOpacity
        className={`w-full bg-primary p-4 rounded-xl items-center flex-row justify-center ${scanning ? 'opacity-70' : ''}`}
        onPress={handleScan}
        disabled={scanning}
      >
        {scanning ? <ActivityIndicator color="#fff" className="mr-3" /> : null}
        <Text className="text-white text-lg font-bold tracking-wide">
          {scanning ? 'Scanning...' : 'Tap to Scan'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
