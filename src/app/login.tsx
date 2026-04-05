import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Animated, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Pulse animation for decorative rings
  const pulse1 = useRef(new Animated.Value(0.4)).current;
  const pulse2 = useRef(new Animated.Value(0.6)).current;
  const pulse3 = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const animate = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 2200, delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(pulse1, 0);
    animate(pulse2, 400);
    animate(pulse3, 800);
  }, []);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    if (!password) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      Alert.alert('Sign In Failed', error.message);
    }
    // On success, the auth listener in _layout.tsx will redirect automatically
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Decorative NFC rings */}
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Animated.View style={{ opacity: pulse3 }} className="absolute w-80 h-80 rounded-full border border-cyan-500/10" />
          <Animated.View style={{ opacity: pulse2 }} className="absolute w-56 h-56 rounded-full border border-cyan-500/15" />
          <Animated.View style={{ opacity: pulse1 }} className="absolute w-36 h-36 rounded-full border border-cyan-500/20" />
        </View>

        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-darkCard border border-darkBorder rounded-2xl items-center justify-center mb-4">
            <Text className="text-3xl">📡</Text>
          </View>
          <Text className="text-white text-3xl font-bold tracking-tight">Lost & Found</Text>
          <Text className="text-darkMuted text-sm mt-1 tracking-widest uppercase">NFC Network</Text>
        </View>

        {/* Heading */}
        <Text className="text-white text-4xl font-bold text-center mb-2">Welcome Back</Text>
        <Text className="text-darkMuted text-base text-center mb-10 px-4">
          Sign in to protect your items{'\n'}and manage your network.
        </Text>

        {/* Form Card */}
        <View className="w-full bg-darkCard border border-darkBorder rounded-3xl p-6 mb-4">
          {/* Email */}
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Email</Text>
          <View className="flex-row items-center bg-slate-800 border border-slate-700 rounded-2xl px-4 mb-4">
            <Text className="text-darkMuted text-lg mr-3">✉️</Text>
            <TextInput
              className="flex-1 text-white text-base py-4"
              placeholder="your@email.com"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Password</Text>
          <View className="flex-row items-center bg-slate-800 border border-slate-700 rounded-2xl px-4 mb-2">
            <Text className="text-darkMuted text-lg mr-3">🔒</Text>
            <TextInput
              className="flex-1 text-white text-base py-4"
              placeholder="Enter your password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
              <Text className="text-slate-500 text-sm font-semibold">{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/forgot-password')}
            className="self-end mb-5"
            activeOpacity={0.7}
          >
            <Text className="text-primary text-sm font-semibold">Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            className={`w-full bg-primary rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
          >
            <Text className="text-slate-900 font-bold text-lg tracking-wide">
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View className="flex-row items-center w-full mb-4">
          <View className="flex-1 h-px bg-darkBorder" />
          <Text className="text-darkMuted text-xs px-4 uppercase tracking-widest">or</Text>
          <View className="flex-1 h-px bg-darkBorder" />
        </View>

        {/* Sign Up Link */}
        <TouchableOpacity
          onPress={() => router.push('/registration')}
          activeOpacity={0.7}
          className="py-2"
        >
          <Text className="text-darkMuted text-base text-center">
            Don't have an account?{'  '}
            <Text className="text-primary font-bold">Create one — it's free</Text>
          </Text>
        </TouchableOpacity>

        <Text className="text-slate-700 text-xs mt-10 text-center">
          By signing in you agree to our Terms & Privacy Policy
        </Text>
      </ScrollView>
    </View>
  );
}
