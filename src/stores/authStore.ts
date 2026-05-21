import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: string;
  isAdmin: boolean;
  initialized: boolean;
  setSession: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: 'student',
  isAdmin: false,
  initialized: false,
  setSession: async (session) => {
    let role = 'student';
    let isAdmin = false;
    
    if (session?.user?.id) {
      try {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('auth_id', session.user.id)
          .single();
          
        if (data) {
          role = data.role;
          isAdmin = data.role === 'admin';
        }
      } catch (e) {
        console.warn('Failed to fetch role:', e);
      }
    }
    
    set({ session, user: session?.user || null, role, isAdmin, initialized: true });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, role: 'student', isAdmin: false });
  },
}));
