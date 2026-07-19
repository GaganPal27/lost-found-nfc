import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// For users whose email domain didn't auto-match an official community
// (personal email providers, or an institutional domain we haven't seen yet).
// They search existing official communities and join directly, since
// community_groups.type defaults to 'public'.

type OfficialGroup = { id: string; name: string; description: string | null; member_count: number };

export default function JoinCommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OfficialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    searchGroups('');
  }, []);

  const searchGroups = async (q: string) => {
    setLoading(true);
    let req = supabase
      .from('community_groups')
      .select('id, name, description, member_count')
      .eq('is_official', true)
      .order('member_count', { ascending: false })
      .limit(30);

    if (q.trim()) req = req.ilike('name', `%${q.trim()}%`);

    const { data, error } = await req;
    if (!error && data) setResults(data as OfficialGroup[]);
    setLoading(false);
  };

  const handleJoin = async (group: OfficialGroup) => {
    if (!user) return;
    setJoiningId(group.id);
    try {
      const { data: profile } = await supabase
        .from('users').select('id').eq('auth_id', user.id).single();
      if (!profile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: profile.id, role: 'member', status: 'active' });

      if (error && error.code !== '23505') throw error; // 23505 = already a member

      await supabase.rpc('increment_group_members', { g_id: group.id }).catch(() => {});
      router.replace(`/group/${group.id}`);
    } catch (e: any) {
      Alert.alert('Couldn\u2019t join', e.message ?? 'Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
        <Text style={styles.backArrow}>\u2190</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Find Your Community</Text>
      <Text style={styles.subtitle}>
        We couldn't auto-detect your college from your email. Search for it below —
        if it doesn't exist yet, create it and you'll be its first member.
      </Text>

      <TextInput
        style={styles.search}
        placeholder="Search by college or university name"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={(t) => { setQuery(t); searchGroups(t); }}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#6366f1" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.member_count} members</Text>
              </View>
              <TouchableOpacity
                style={styles.joinBtn}
                disabled={joiningId === item.id}
                onPress={() => handleJoin(item)}
                activeOpacity={0.8}
              >
                {joiningId === item.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.joinBtnText}>Join</Text>}
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matching community</Text>
              <Text style={styles.emptySubtitle}>
                Ask a friend at your college to sign up first \u2014 official communities
                are created automatically from a college email address.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 20 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#0f172a' },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 20, marginTop: 6, marginBottom: 20 },
  search: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#0f172a', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  cardMeta: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  joinBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18 },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 19 },
});
