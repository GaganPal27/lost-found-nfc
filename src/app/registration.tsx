import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Animated, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function RegistrationScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const getPasswordStrength = () => {
    if (!password) return null;
    if (password.length < 6) return { label: 'Too short', color: 'bg-red-500', widthPct: 25 };
    if (password.length < 8) return { label: 'Weak', color: 'bg-amber-500', widthPct: 50 };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Fair', color: 'bg-yellow-400', widthPct: 70 };
    return { label: 'Strong', color: 'bg-green-500', widthPct: 100 };
  };

  const strength = getPasswordStrength();

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
      },
    });

    if (error) {
      Alert.alert('Registration Failed', error.message);
    } else if (data.user && !data.session) {
      // Email confirmation required (Supabase setting)
      Alert.alert(
        '📧 Confirm your email',
        `We sent a confirmation link to ${email}. Click it to activate your account, then sign in.`,
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    }
    // If session is returned immediately (email confirm OFF in Supabase), auth listener handles redirect
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} className="mb-8 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Back to Sign In</Text>
        </TouchableOpacity>

        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          {/* Header */}
          <View className="mb-8">
            <View className="w-16 h-16 bg-darkCard border border-darkBorder rounded-2xl items-center justify-center mb-6">
              <Text className="text-3xl">🛡️</Text>
            </View>
            <Text className="text-white text-4xl font-bold mb-2">Create Account</Text>
            <Text className="text-darkMuted text-base leading-6">
              Join the Lost & Found Network.{'\n'}Protect your valuables — for free.
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-darkCard border border-darkBorder rounded-3xl p-6 mb-5">
            {/* Name */}
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Full Name</Text>
            <View className="flex-row items-center bg-slate-800 border border-slate-700 rounded-2xl px-4 mb-4">
              <Text className="text-darkMuted text-lg mr-3">👤</Text>
              <TextInput
                className="flex-1 text-white text-base py-4"
                placeholder="e.g. Alex Chen"
                placeholderTextColor="#64748b"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Email */}
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Email Address</Text>
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
                placeholder="At least 6 characters"
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

            {/* Password Strength */}
            {strength && (
              <View className="mb-4">
                <View className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-1">
                  <View className={`h-full rounded-full ${strength.color}`} style={{ width: `${strength.widthPct}%` }} />
                </View>
                <Text className={`text-xs font-semibold ${
                  strength.label === 'Strong' ? 'text-green-400' :
                  strength.label === 'Fair' ? 'text-yellow-400' :
                  strength.label === 'Weak' ? 'text-amber-400' : 'text-red-400'
                }`}>{strength.label}</Text>
              </View>
            )}

            {/* Confirm Password */}
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Confirm Password</Text>
            <View className={`flex-row items-center bg-slate-800 rounded-2xl px-4 mb-6 border ${
              confirmPassword && confirmPassword !== password ? 'border-red-500/50' : 'border-slate-700'
            }`}>
              <Text className="text-darkMuted text-lg mr-3">🔑</Text>
              <TextInput
                className="flex-1 text-white text-base py-4"
                placeholder="Re-enter password"
                placeholderTextColor="#64748b"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} activeOpacity={0.7}>
                <Text className="text-slate-500 text-sm font-semibold">{showConfirm ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword && confirmPassword !== password && (
              <Text className="text-red-400 text-xs mb-4 -mt-4">Passwords do not match</Text>
            )}

            {/* Create Button */}
            <TouchableOpacity
              className={`w-full bg-primary rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
              style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
            >
              <Text className="text-slate-900 font-bold text-lg tracking-wide">
                {loading ? 'Creating Account...' : 'Create Free Account'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* What's Included */}
          <View className="bg-darkCard border border-darkBorder rounded-3xl p-5 mb-6">
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-4 font-semibold">Free plan includes</Text>
            {[
              { icon: '📦', title: 'Protect up to 2 items', sub: 'NFC tags supported' },
              { icon: '📱', title: 'NFC Scanning', sub: 'Let finders contact you instantly' },
              { icon: '🔔', title: 'Real-time alerts', sub: 'Know when your item is found' },
            ].map((f, i) => (
              <View key={i} className={`flex-row items-center py-3 ${i !== 2 ? 'border-b border-slate-700' : ''}`}>
                <View className="w-10 h-10 bg-slate-800 rounded-xl items-center justify-center mr-4">
                  <Text className="text-xl">{f.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold">{f.title}</Text>
                  <Text className="text-darkMuted text-sm">{f.sub}</Text>
                </View>
                <Text className="text-primary font-bold text-lg">✓</Text>
              </View>
            ))}
          </View>

          {/* Sign In Link */}
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="py-2">
            <Text className="text-darkMuted text-base text-center">
              Already have an account?{'  '}
              <Text className="text-primary font-bold">Sign In</Text>
            </Text>
          </TouchableOpacity>

          <Text className="text-slate-700 text-xs mt-6 text-center px-6">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
