import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Safely initialize to prevent instant crash on launch if keys are missing/invalid
let supabase: any;
if (supabaseUrl && supabaseUrl.startsWith('http')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,       // ← Persist session to device storage
      persistSession: true,        // ← Keep session across app restarts
      autoRefreshToken: true,      // ← Refresh tokens automatically
      detectSessionInUrl: false,   // ← Disable URL-based session detection (mobile only)
    },
  });
} else {
  // Provide a safe mock to prevent 'undefined' crashes down the line
  supabase = { 
    auth: { 
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) 
    } as any 
  };
}

export { supabase };
