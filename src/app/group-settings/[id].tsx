import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const fetchGroup = async () => {
    const { data } = await supabase.from('community_groups').select('*').eq('id', id).single();
    if (data) {
      setGroup(data);
      setIsPublic(data.type === 'public');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const newType = isPublic ? 'public' : 'private';
    try {
      await supabase.from('community_groups').update({ type: newType }).eq('id', id);
      Alert.alert('Saved', 'Group settings updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSaving(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Group', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('community_groups').delete().eq('id', id);
          router.replace('/(tabs)/community');
      }}
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;
  if (!group) return <View style={styles.center}><Text>Not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Group Settings</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push(`/group-members/${id}`)}>
          <Text style={styles.menuText}>👥 Manage Members ({group.member_count})</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        
        {group.type === 'private' && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push(`/group-requests/${id}`)}>
            <Text style={styles.menuText}>🔔 Join Requests</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuText}>Public Group</Text>
            <Text style={styles.menuDesc}>If off, users must request to join.</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: '#6366f1' }} />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save Settings</Text>}
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { marginTop: 40 }]}>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteTxt}>Delete Group</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { padding: 10, marginRight: 8 },
  backTxt: { fontSize: 24, color: '#0f172a' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  
  section: { backgroundColor: '#fff', marginTop: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  menuDesc: { fontSize: 12, color: '#64748b', marginTop: 4 },
  chevron: { fontSize: 20, color: '#94a3b8' },
  
  saveBtn: { backgroundColor: '#6366f1', margin: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  deleteBtn: { padding: 16, alignItems: 'center' },
  deleteTxt: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});
