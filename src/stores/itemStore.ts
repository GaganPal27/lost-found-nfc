import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface ItemState {
  itemsCount: number;
  initialized: boolean;
  fetchCount: (userId: string) => Promise<void>;
}

export const useItemStore = create<ItemState>((set) => ({
  itemsCount: 0,
  initialized: false,
  fetchCount: async (userId: string) => {
    const { count } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      // Ignore deleted status items? Sure, but assuming basic limits apply to active
      .neq('status', 'deleted');
      
    set({ itemsCount: count || 0, initialized: true });
  },
}));
