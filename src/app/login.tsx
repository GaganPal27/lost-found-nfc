import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Animated, StatusBar, ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
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
      <StatusBar barStyle="dark-content" />
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {/* Decorative NFC rings */}
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Animated.View style={{ opacity: pulse3 }} className="absolute w-80 h-80 rounded-full border border-primary/5" />
          <Animated.View style={{ opacity: pulse2 }} className="absolute w-56 h-56 rounded-full border border-primary/10" />
          <Animated.View style={{ opacity: pulse1 }} className="absolute w-36 h-36 rounded-full border border-primary/20" />
        </View>

        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-white border border-slate-200 rounded-2xl items-center justify-center mb-4 shadow-sm">
            <Text className="text-3xl">📡</Text>
          </View>
          <Text className="text-slate-900 text-3xl font-black tracking-tight select-none">Lost & Found</Text>
          <Text className="text-slate-500 text-sm mt-1 tracking-widest uppercase font-bold select-none">NFC Network</Text>
        </View>

        {/* Heading */}
        <Text className="text-slate-900 text-4xl font-black text-center mb-2 select-none">Welcome Back</Text>
        <Text className="text-slate-500 text-base text-center mb-10 px-4 font-medium select-none">
          Sign in to protect your items{'\n'}and manage your network.
        </Text>

        {/* Form Card */}
        <View className="w-full bg-white border border-slate-200 rounded-3xl p-6 mb-4 shadow-sm">
          {/* Email */}
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold select-none">Email</Text>
          <View className="flex-row items-center bg-darkBg border border-slate-100 rounded-2xl px-4 mb-4 shadow-sm">
            <Text className="text-slate-400 text-lg mr-3">✉️</Text>
            <TextInput
              className="flex-1 text-slate-900 text-base py-4 font-medium"
              placeholder="your@email.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Password */}
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold select-none">Password</Text>
          <View className="flex-row items-center bg-darkBg border border-slate-100 rounded-2xl px-4 mb-2 shadow-sm">
            <Text className="text-slate-400 text-lg mr-3">🔒</Text>
            <TextInput
              className="flex-1 text-slate-900 text-base py-4 font-medium"
              placeholder="Enter your password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              ref={passwordRef}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
              <Text className="text-slate-500 text-sm font-bold">{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/forgot-password')}
            className="self-end mb-5"
            activeOpacity={0.7}
          >
            <Text className="text-primary text-sm font-bold">Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            className={`w-full bg-primary rounded-2xl py-4 items-center shadow-md shadow-primary/30 ${loading ? 'opacity-60' : ''}`}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-lg tracking-wide">
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View className="flex-row items-center w-full mb-4">
          <View className="flex-1 h-px bg-slate-200" />
          <Text className="text-slate-400 text-xs px-4 uppercase tracking-widest font-bold">or</Text>
          <View className="flex-1 h-px bg-slate-200" />
        </View>

        {/* Sign Up Link */}
        <TouchableOpacity
          onPress={() => router.push('/registration')}
          activeOpacity={0.7}
          className="py-2"
        >
          <Text className="text-slate-600 text-base text-center font-medium">
            Don't have an account?{'  '}
            <Text className="text-primary font-bold">Create one — it's free</Text>
          </Text>
        </TouchableOpacity>

        <Text className="text-slate-400 text-xs mt-10 text-center font-medium">
          By signing in you agree to our Terms & Privacy Policy
        </Text>
      </KeyboardAwareScrollView>
    </View>
  );
}
