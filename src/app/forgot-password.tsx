import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Animated, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

type Stage = 'email' | 'sent';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>('email');
  const router = useRouter();

  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'lostfoundnfc://reset-password',
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setStage('sent');
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-8 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Back to Sign In</Text>
        </TouchableOpacity>

        <Animated.View style={{ opacity: fadeIn, flex: 1, justifyContent: 'center' }}>
          {stage === 'email' ? (
            <>
              {/* Header */}
              <View className="mb-10">
                <View className="w-16 h-16 bg-darkCard border border-darkBorder rounded-2xl items-center justify-center mb-6">
                  <Text className="text-3xl">🔑</Text>
                </View>
                <Text className="text-white text-4xl font-bold mb-2">Forgot Password?</Text>
                <Text className="text-darkMuted text-base leading-6">
                  No worries. Enter your email and we'll send you a link to reset your password.
                </Text>
              </View>

              {/* Form */}
              <View className="bg-darkCard border border-darkBorder rounded-3xl p-6 mb-4">
                <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Email Address</Text>
                <View className="flex-row items-center bg-slate-800 border border-slate-700 rounded-2xl px-4 mb-5">
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
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                  />
                </View>

                <TouchableOpacity
                  className={`w-full bg-primary rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
                  onPress={handleReset}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
                >
                  <Text className="text-slate-900 font-bold text-lg tracking-wide">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View className="bg-darkCard border border-darkBorder rounded-2xl p-4">
                <Text className="text-slate-500 text-xs text-center leading-5">
                  If an account exists for this email, you'll receive a reset link within a few minutes. Check your spam folder too.
                </Text>
              </View>
            </>
          ) : (
            /* Success State */
            <View className="items-center py-12">
              <View
                className="w-28 h-28 bg-green-500/15 border border-green-500/30 rounded-full items-center justify-center mb-8"
                style={{ shadowColor: '#22c55e', shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 }}
              >
                <Text className="text-6xl">📧</Text>
              </View>

              <Text className="text-white text-3xl font-bold text-center mb-3">Check your inbox</Text>
              <Text className="text-slate-400 text-base text-center leading-6 px-4 mb-2">
                We sent a password reset link to:
              </Text>
              <Text className="text-primary font-bold text-base mb-8">{email}</Text>

              <View className="bg-darkCard border border-darkBorder rounded-3xl p-5 w-full mb-8">
                {[
                  { num: '1', text: 'Open the email from Lost & Found Network' },
                  { num: '2', text: 'Tap the "Reset Password" link' },
                  { num: '3', text: 'Choose a new password and sign in' },
                ].map((step, i) => (
                  <View key={i} className={`flex-row items-center py-3 ${i !== 2 ? 'border-b border-slate-700' : ''}`}>
                    <View className="w-7 h-7 bg-primary/20 border border-primary/30 rounded-full items-center justify-center mr-4">
                      <Text className="text-primary text-xs font-bold">{step.num}</Text>
                    </View>
                    <Text className="text-slate-300 text-sm flex-1">{step.text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => router.replace('/login')}
                className="w-full bg-primary py-4 rounded-2xl items-center mb-5"
                activeOpacity={0.85}
                style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
              >
                <Text className="text-slate-900 font-bold text-lg">Back to Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStage('email'); setEmail(''); }}
                activeOpacity={0.7}
              >
                <Text className="text-slate-500 text-sm">Didn't receive it? Try again</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
