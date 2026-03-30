import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Item {
  id: string;
  user_id: string;
  item_name: string;
  category: string;
  color: string;
  image_url: string;
  nfc_uid: string;
  ble_beacon_id: string;
  tag_type: 'nfc_only' | 'nfc_ble' | 'ble_only';
  status: 'active' | 'lost' | 'found' | 'deleted';
  last_seen_lat: number;
  last_seen_lng: number;
  last_seen_at: string;
}

interface ItemState {
  items: Item[];
  itemsCount: number;
  initialized: boolean;
  fetchMyItems: (userId: string) => Promise<void>;
  fetchCount: (userId: string) => Promise<void>;
  updateStatus: (id: string, status: Item['status']) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  subscribeToItems: (userId: string) => void;
  unsubscribeFromItems: () => void;
}

let subscription: any = null;

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  itemsCount: 0,
  initialized: false,

  fetchCount: async (userId: string) => {
    const { count } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'deleted');
    set({ itemsCount: count || 0, initialized: true });
  },

  fetchMyItems: async (userId: string) => {
    const { data, count } = await supabase
      .from('items')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });
      
    if (data) {
      set({ items: data as Item[], itemsCount: count || 0, initialized: true });
    }
  },

  updateStatus: async (id: string, status: Item['status']) => {
    await supabase.from('items').update({ status }).eq('id', id);
    const updatedItems = get().items.map(item => item.id === id ? { ...item, status } : item);
    set({ items: updatedItems });
  },

  deleteItem: async (id: string) => {
    await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
    const filteredItems = get().items.filter(item => item.id !== id);
    set({ items: filteredItems, itemsCount: get().itemsCount - 1 });
  },

  subscribeToItems: (userId: string) => {
    if (subscription) return;
    
    subscription = supabase
      .channel('public:items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` }, () => {
         get().fetchMyItems(userId);
      })
      .subscribe();
  },

  unsubscribeFromItems: () => {
    if (subscription) {
      supabase.removeChannel(subscription);
      subscription = null;
    }
  }
}));
