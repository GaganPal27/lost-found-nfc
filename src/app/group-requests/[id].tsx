import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GroupRequestsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, [id]);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*, user:user_id(name, email)')
      .eq('group_id', id)
      .eq('status', 'pending');
      
    if (data) {
      const formatted = data.map(r => ({
        ...r,
        user_name: r.user?.name || r.user?.email?.split('@')[0] || 'Unknown User'
      }));
      setRequests(formatted);
    }
    setLoading(false);
  };

  const handleApprove = async (reqId: string, userId: string) => {
    try {
      await supabase.from('group_members').update({ status: 'active' }).eq('id', reqId);
      await supabase.rpc('increment_group_members', { g_id: id }); // bump count
      setRequests(prev => prev.filter(r => r.id !== reqId));
      
      // Notify user
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Request Approved ✅',
        body: 'Your request to join the group was approved.',
        type: 'group_approved',
        data: { route: `/group/${id}` }
      });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      await supabase.from('group_members').delete().eq('id', reqId);
      setRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Join Requests</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={i => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 24) }]}
        ListEmptyComponent={<Text style={styles.empty}>No pending requests</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.info}>
              <View style={styles.avatar}><Text>👤</Text></View>
              <Text style={styles.name}>{item.user_name}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                <Text style={styles.rejectTxt}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id, item.user_id)}>
                <Text style={styles.approveTxt}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { padding: 10, marginRight: 8 },
  backTxt: { fontSize: 24, color: '#0f172a' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  list: { padding: 16 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  info: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  rejectBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#fee2e2' },
  rejectTxt: { color: '#ef4444', fontWeight: 'bold' },
  approveBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#6366f1' },
  approveTxt: { color: '#fff', fontWeight: 'bold' },
});
