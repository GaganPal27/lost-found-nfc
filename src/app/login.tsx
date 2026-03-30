import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'lostfoundnfc://' }
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check your email', 'We sent you a login link!');
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white">
      <Text className="text-4xl font-bold text-primary mb-2">Lost & Found</Text>
      <Text className="text-gray-500 mb-8 text-lg">Sign in to protect your items.</Text>
      
      <TextInput
        className="border border-gray-300 rounded-xl p-4 mb-4 text-lg"
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity 
        className={`bg-primary p-4 rounded-xl items-center ${loading ? 'opacity-50' : ''}`}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text className="text-white text-lg font-semibold">
          {loading ? 'Sending link...' : 'Send Magic Link'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
