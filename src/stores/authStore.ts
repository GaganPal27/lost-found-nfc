import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: string;
  isAdmin: boolean;
  initialized: boolean;
  dbUser: { full_name?: string; successful_recoveries?: number; created_at?: string; id?: string } | null;
  setSession: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: 'student',
  isAdmin: false,
  initialized: false,
  dbUser: null,
  setSession: async (session) => {
    let role = 'student';
    let isAdmin = false;
    let dbUser = null;
    
    if (session?.user?.id) {
      try {
        const { data } = await supabase
          .from('users')
          .select('id, role, full_name, successful_recoveries, created_at')
          .eq('auth_id', session.user.id)
          .single();
          
        if (data) {
          role = data.role;
          isAdmin = data.role === 'admin';
          dbUser = { 
            id: data.id,
            full_name: data.full_name, 
            successful_recoveries: data.successful_recoveries, 
            created_at: data.created_at 
          };
        }
      } catch (e) {
        console.warn('Failed to fetch role/name:', e);
      }
    }
    
    set({ session, user: session?.user || null, role, isAdmin, dbUser, initialized: true });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, role: 'student', isAdmin: false, dbUser: null });
  },
}));
