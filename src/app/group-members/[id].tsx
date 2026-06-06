import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<'admin'|'member'|null>(null);

  useEffect(() => {
    fetchMembers();
  }, [id, user]);

  const fetchMembers = async () => {
    if (!id || !user) return;
    const { data } = await supabase
      .from('group_members')
      .select('*, user:user_id(name, email)')
      .eq('group_id', id)
      .eq('status', 'active');
      
    if (data) {
      const formatted = data.map(r => ({
        ...r,
        user_name: r.user?.name || r.user?.email?.split('@')[0] || 'Unknown User'
      }));
      setMembers(formatted);
      
      const me = formatted.find(m => m.user_id === user.id);
      if (me) setMyRole(me.role);
    }
    setLoading(false);
  };

  const handleRemove = (memId: string, userId: string) => {
    Alert.alert('Remove Member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('group_members').delete().eq('id', memId);
          await supabase.rpc('decrement_group_members', { g_id: id });
          setMembers(prev => prev.filter(m => m.id !== memId));
        } catch (e: any) { Alert.alert('Error', e.message); }
      }}
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Group Members</Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.info}>
              <View style={styles.avatar}><Text>👤</Text></View>
              <View>
                <Text style={styles.name}>{item.user_name} {item.user_id === user?.id && '(You)'}</Text>
                <Text style={styles.role}>{item.role.toUpperCase()}</Text>
              </View>
            </View>
            
            {myRole === 'admin' && item.user_id !== user?.id && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.id, item.user_id)}>
                <Text style={styles.removeTxt}>Remove</Text>
              </TouchableOpacity>
            )}
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
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  info: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  role: { fontSize: 12, color: '#64748b', marginTop: 2 },
  removeBtn: { padding: 8 },
  removeTxt: { color: '#ef4444', fontWeight: 'bold' },
});
