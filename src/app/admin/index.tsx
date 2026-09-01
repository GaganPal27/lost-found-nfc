import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Alert, Modal, RefreshControl, Linking, StyleSheet, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

type AdminUser = { id: string; auth_id: string; email: string; full_name: string; role: string; subscription_tier: string; created_at: string };
type AdminItem = { id: string; user_id: string; item_name: string; category: string; tag_type: string; status: string; last_seen_lat: number | null; last_seen_lng: number | null; last_seen_at: string | null; created_at: string; owner_email: string; owner_name: string; nfc_uid: string; ble_beacon_id: string; description: string; color: string };
type VerificationItem = {
  id: string; user_id: string; group_id: string;
  id_card_url: string; status: string; submitted_at: string;
  email: string; full_name: string | null; group_name: string;
};

const ROLES = ['public_user', 'student', 'tester', 'developer', 'admin'] as const;
const TIERS = ['basic', 'pro', 'max'] as const;

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  admin:       { label: 'Admin',     color: '#a78bfa', bg: 'rgba(124,58,237,0.15)'  },
  developer:   { label: 'Dev',       color: '#60a5fa', bg: 'rgba(37,99,235,0.15)'   },
  tester:      { label: 'Tester',    color: '#fb923c', bg: 'rgba(234,88,12,0.15)'   },
  student:     { label: 'Student',   color: '#4ade80', bg: 'rgba(22,163,74,0.15)'   },
  public_user: { label: 'User',      color: '#94a3b8', bg: 'rgba(51,65,85,0.4)'     },
};
const TIER_META: Record<string, { label: string; color: string; bg: string }> = {
  max:   { label: 'Max',   color: '#22d3ee', bg: 'rgba(8,145,178,0.18)'  },
  pro:   { label: 'Pro',   color: '#818cf8', bg: 'rgba(79,70,229,0.18)'  },
  basic: { label: 'Basic', color: '#64748b', bg: 'rgba(51,65,85,0.35)'   },
};
const TAG_ICON: Record<string, string> = { nfc_only: '≡ƒô▒', ble_only: '≡ƒôí', nfc_ble: '≡ƒöù' };

function VerificationCard({ item, onApprove, onReject }: { item: VerificationItem; onApprove: () => void; onReject: () => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);

  useEffect(() => {
    const filePath = item.id_card_url.replace(/^id-verifications\//, '');
    supabase.storage
      .from('id-verifications')
      .createSignedUrl(filePath, 3600)
      .then(({ data }) => {
        setSignedUrl(data?.signedUrl ?? null);
        setImgLoading(false);
      });
  }, [item.id_card_url]);

  const fmtDate = (ts: string) =>
    new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.verifyCard}>
      <View style={s.verifyImgBox}>
        {imgLoading ? (
          <ActivityIndicator color="#6366f1" />
        ) : signedUrl ? (
          <Image source={{ uri: signedUrl }} style={s.verifyImg} resizeMode="contain" />
        ) : (
          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>{'Image\nunavailable'}</Text>
        )}
      </View>
      <View style={s.verifyInfo}>
        <Text style={s.verifyEmail} numberOfLines={1}>{item.email}</Text>
        {item.full_name ? <Text style={s.verifyName}>{item.full_name}</Text> : null}
        <View style={s.verifyMetaRow}>
          <Text style={s.verifyMetaKey}>College</Text>
          <Text style={s.verifyMetaVal} numberOfLines={2}>{item.group_name}</Text>
        </View>
        <View style={s.verifyMetaRow}>
          <Text style={s.verifyMetaKey}>Submitted</Text>
          <Text style={s.verifyMetaVal}>{fmtDate(item.submitted_at)}</Text>
        </View>
      </View>
      <View style={s.verifyActions}>
        <TouchableOpacity style={[s.verifyBtn, s.verifyBtnApprove]} onPress={onApprove} activeOpacity={0.85}>
          <Text style={s.verifyBtnApproveText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.verifyBtn, s.verifyBtnReject]} onPress={onReject} activeOpacity={0.85}>
          <Text style={s.verifyBtnRejectText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ItemModal({ item, onClose }: { item: AdminItem; onClose: () => void }) {
  const [mapReady, setMapReady] = useState(false);

  const openMaps = () => {
    const lat = item.last_seen_lat!, lng = item.last_seen_lng!;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(err => console.error("Couldn't open maps", err));
  };

  const fmt = (ts: string | null) => ts ? new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => setMapReady(true)}
      onRequestClose={() => { setMapReady(false); onClose(); }}
    >
      <View style={s.modalBg}>
        <View style={s.modalHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.modalSub}>Item Detail</Text>
            <Text style={s.modalTitle} numberOfLines={1}>{item.item_name}</Text>
          </View>
          <TouchableOpacity onPress={() => { setMapReady(false); onClose(); }} style={s.closeBtn}>
            <Text style={{ color: '#94a3b8', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {item.last_seen_lat && item.last_seen_lng ? (
            <TouchableOpacity onPress={openMaps} activeOpacity={0.9} style={s.mapContainer}>
              {mapReady ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={{ flex: 1 }}
                  initialRegion={{ latitude: item.last_seen_lat, longitude: item.last_seen_lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: item.last_seen_lat, longitude: item.last_seen_lng }} title={item.item_name} />
                </MapView>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1929' }}>
                  <ActivityIndicator color="#06b6d4" size="small" />
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>Loading map…</Text>
                </View>
              )}
              <View style={s.mapOverlay}>
                <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 12 }}>📍 Open in Maps ➔</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[s.mapContainer, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📍</Text>
              <Text style={{ color: '#475569', fontSize: 13 }}>No location recorded yet</Text>
            </View>
          )}

          <View style={s.card}>
            <Text style={s.cardLabel}>Owner</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.ownerAvatar}><Text style={{ color: '#06b6d4', fontWeight: '800', fontSize: 16 }}>{(item.owner_email?.[0] || '?').toUpperCase()}</Text></View>
              <View>
                <Text style={{ color: '#f1f5f9', fontWeight: '700' }}>{item.owner_name || 'Unknown'}</Text>
                <Text style={{ color: '#64748b', fontSize: 12 }}>{item.owner_email || 'No email'}</Text>
              </View>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardLabel}>Details</Text>
            {[['Category', item.category], ['Color', item.color || '—'], ['Status', item.status], ['Registered', fmt(item.created_at)]].map(([k, v]) => (
              <View key={k} style={s.row}><Text style={s.rowKey}>{k}</Text><Text style={s.rowVal} numberOfLines={2}>{v}</Text></View>
            ))}
          </View>

          {item.last_seen_lat && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Coordinates</Text>
              <Text style={{ color: '#e11d48', fontFamily: 'monospace', fontSize: 13, marginBottom: 4 }}>{item.last_seen_lat.toFixed(6)}, {item.last_seen_lng?.toFixed(6)}</Text>
              <Text style={{ color: '#64748b', fontSize: 11 }}>Last seen {fmt(item.last_seen_at)}</Text>
            </View>
          )}

          {(item.ble_beacon_id || item.nfc_uid) && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Hardware IDs</Text>
              {item.ble_beacon_id && <Text style={{ color: '#e11d48', fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>📶 {item.ble_beacon_id}</Text>}
              {item.nfc_uid && <Text style={{ color: '#e11d48', fontFamily: 'monospace', fontSize: 12 }} numberOfLines={1}>≡ {item.nfc_uid}</Text>}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function UserRow({ user, userItems, onRole, onTier }: { user: AdminUser; userItems: AdminItem[]; onRole: (id: string, r: string) => void; onTier: (id: string, t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AdminItem | null>(null);
  const rm = ROLE_META[user.role] || ROLE_META.public_user;
  const initial = (user.email?.[0] || '?').toUpperCase();

  return (
    <>
      {detail && <ItemModal item={detail} onClose={() => setDetail(null)} />}
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(o => !o)}
        style={[s.userCard, { borderColor: open ? rm.color + '50' : '#e2e8f0' }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <View style={[s.userAvatar, { backgroundColor: rm.bg, borderColor: rm.color + '60' }]}>
            <Text style={{ color: rm.color, fontWeight: '900', fontSize: 18 }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{user.email || 'No email'}</Text>
            {user.full_name ? <Text style={{ color: '#64748b', fontSize: 12, marginTop: 1 }}>{user.full_name}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {[{ bg: rm.bg, color: rm.color, label: rm.label }, { bg: TIER_META[user.subscription_tier]?.bg, color: TIER_META[user.subscription_tier]?.color, label: (TIER_META[user.subscription_tier]?.label || user.subscription_tier).toUpperCase() }].map(b => (
                <View key={b.label} style={{ backgroundColor: b.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: b.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{b.label}</Text>
                </View>
              ))}
              <View style={{ backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800' }}>{userItems.length} ITEMS</Text>
              </View>
            </View>
          </View>
          <Text style={{ color: '#94a3b8', fontSize: 20, marginLeft: 8 }}>{open ? '▼' : '▲'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={[s.expandBody, { borderColor: rm.color + '40' }]}>
          <Text style={s.sectionLabel}>Role</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {ROLES.map(r => { const m = ROLE_META[r]; const active = user.role === r;
              return <TouchableOpacity key={r} onPress={() => onRole(user.id, r)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, backgroundColor: active ? m.bg : 'transparent', borderColor: active ? m.color : '#e2e8f0' }} activeOpacity={0.75}><Text style={{ color: active ? m.color : '#64748b', fontSize: 12, fontWeight: '700' }}>{m.label}</Text></TouchableOpacity>;
            })}
          </View>
          <Text style={s.sectionLabel}>Subscription</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {TIERS.map(t => { const m = TIER_META[t]; const active = user.subscription_tier === t;
              return <TouchableOpacity key={t} onPress={() => onTier(user.id, t)} style={{ flex: 1, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', backgroundColor: active ? m.bg : 'transparent', borderColor: active ? m.color : '#e2e8f0' }} activeOpacity={0.75}><Text style={{ color: active ? m.color : '#64748b', fontWeight: '800', fontSize: 13 }}>{t.toUpperCase()}</Text></TouchableOpacity>;
            })}
          </View>
          <Text style={s.sectionLabel}>Items ({userItems.length})</Text>
          {userItems.length === 0
            ? <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderRadius: 12 }}><Text style={{ color: '#64748b' }}>No items registered</Text></View>
            : userItems.map(item => (
              <TouchableOpacity key={item.id} onPress={() => setDetail(item)} style={s.itemRow} activeOpacity={0.8}>
                <View style={[s.itemIcon, { backgroundColor: item.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                  <Text style={{ fontSize: 18 }}>{TAG_ICON[item.tag_type] || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{item.item_name}</Text>
                  <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{item.category} • {item.tag_type.replace(/_/g, ' ')}</Text>
                </View>
                {item.last_seen_lat ? <Text style={{ color: '#e11d48', fontSize: 11 }}>📍</Text> : <Text style={{ color: '#94a3b8', fontSize: 11 }}>—</Text>}
                <Text style={{ color: '#94a3b8', fontSize: 18, marginLeft: 8 }}>›</Text>
              </TouchableOpacity>
            ))
          }
        </View>
      )}
    </>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const [adminTab, setAdminTab] = useState<'users' | 'verifications'>('verifications');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rpcError, setRpcError] = useState(false);

  useEffect(() => {
    if (!isAdmin) { Alert.alert('Access Denied', 'Admins only.'); router.replace('/'); return; }
    load();
  }, [isAdmin]);

  const loadVerifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('id_verifications')
        .select('id, user_id, group_id, id_card_url, status, submitted_at, users!user_id(email,full_name), community_groups!group_id(name)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });
      if (error) { console.warn('Verifications fetch error:', error); return; }
      setVerifications((data ?? []).map((v: any) => ({
        id: v.id, user_id: v.user_id, group_id: v.group_id,
        id_card_url: v.id_card_url, status: v.status, submitted_at: v.submitted_at,
        email: v.users?.email ?? '', full_name: v.users?.full_name ?? null,
        group_name: v.community_groups?.name ?? 'Unknown',
      })));
    } catch (e) { console.warn('Verifications fetch failed:', e); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setRpcError(false);
    try {
      const [ur, ir] = await Promise.all([supabase.rpc('admin_get_all_users'), supabase.rpc('admin_get_all_items')]);
      if (ur.error || ir.error) {
        setRpcError(true);
        const [uf, itf] = await Promise.all([supabase.from('users').select('*').order('created_at', { ascending: false }), supabase.from('items').select('*, users(email,full_name)').order('created_at', { ascending: false })]);
        if (uf.data) setUsers(uf.data as AdminUser[]);
        if (itf.data) setItems(itf.data.map((i: any) => ({ ...i, owner_email: i.users?.email || '', owner_name: i.users?.full_name || '' })) as AdminItem[]);
      } else {
        if (ur.data) setUsers(ur.data as AdminUser[]);
        if (ir.data) setItems(ir.data as AdminItem[]);
      }
    } catch { setRpcError(true); }
    finally { setLoading(false); setRefreshing(false); }
    loadVerifications();
  }, []);

  const handleApprove = (item: VerificationItem) => {
    Alert.alert('Approve Verification', `Approve ${item.email} for ${item.group_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        const now = new Date().toISOString();
        const [r1, r2] = await Promise.all([
          supabase.from('id_verifications').update({ status: 'approved', reviewed_at: now }).eq('id', item.id),
          supabase.from('group_members').update({ membership_status: 'active' }).eq('user_id', item.user_id).eq('group_id', item.group_id),
        ]);
        if (r1.error || r2.error) { Alert.alert('Error', 'Could not approve.'); return; }
        setVerifications(prev => prev.filter(v => v.id !== item.id));
      }},
    ]);
  };

  const handleReject = (item: VerificationItem) => {
    Alert.alert('Reject Verification', `Reject ${item.email}'s ID? They can resubmit.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        const now = new Date().toISOString();
        const [r1, r2] = await Promise.all([
          supabase.from('id_verifications').update({ status: 'rejected', reviewed_at: now }).eq('id', item.id),
          supabase.from('group_members').update({ membership_status: 'rejected' }).eq('user_id', item.user_id).eq('group_id', item.group_id),
        ]);
        if (r1.error || r2.error) { Alert.alert('Error', 'Could not reject.'); return; }
        setVerifications(prev => prev.filter(v => v.id !== item.id));
      }},
    ]);
  };

  const applyRole = async (uid: string, role: string) => {
    const { error } = await supabase.rpc('admin_set_user_role', { target_user_id: uid, new_role: role }).then(r => r.error ? supabase.from('users').update({ role }).eq('id', uid) : r);
    if (error) { Alert.alert('Error', error.message); return; }
    setUsers(p => p.map(u => u.id === uid ? { ...u, role } : u));
  };

  const applyTier = async (uid: string, tier: string) => {
    const { error } = await supabase.from('users').update({ subscription_tier: tier }).eq('id', uid);
    if (error) { Alert.alert('Error', error.message); return; }
    setUsers(p => p.map(u => u.id === uid ? { ...u, subscription_tier: tier } : u));
  };

  const enriched = items.map(i => { if (i.owner_email) return i; const o = users.find(u => u.id === i.user_id); return { ...i, owner_email: o?.email || '', owner_name: o?.full_name || '' }; });

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6366f1" /><Text style={{ color: '#475569', marginTop: 12 }}>Loading...</Text></View>;

  return (
    <View style={s.bg}>
      <StatusBar barStyle="light-content" backgroundColor="#f8fafc" />
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>Admin Console</Text>
          <Text style={s.headerTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn2}><Text style={{ color: '#64748b', fontWeight: '600', fontSize: 13 }}>Close</Text></TouchableOpacity>
      </View>

      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, adminTab === 'users' && s.tabBtnActive]} onPress={() => setAdminTab('users')} activeOpacity={0.7}>
          <Text style={[s.tabBtnText, adminTab === 'users' && s.tabBtnTextActive]}>Users ({users.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, adminTab === 'verifications' && s.tabBtnActive]} onPress={() => setAdminTab('verifications')} activeOpacity={0.7}>
          <Text style={[s.tabBtnText, adminTab === 'verifications' && s.tabBtnTextActive]}>
            {verifications.length > 0 ? `Verify (${verifications.length})` : 'Verify (clear)'}
          </Text>
        </TouchableOpacity>
      </View>

      {rpcError && adminTab === 'users' && <View style={s.warn}><Text style={{ color: '#eab308', fontSize: 11, fontWeight: '600' }}>Run 007_admin_rpc.sql for full cross-user access.</Text></View>}

      {adminTab === 'verifications' ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadVerifications().then(() => setRefreshing(false)); }} tintColor="#6366f1" colors={['#6366f1']} />}>
          {verifications.length === 0 ? (
            <View style={[s.center, { paddingTop: 60 }]}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>OK</Text>
              <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 18, marginBottom: 8 }}>All clear</Text>
              <Text style={{ color: '#64748b', textAlign: 'center', lineHeight: 22 }}>No pending verifications. Pull to refresh.</Text>
            </View>
          ) : (
            <>{verifications.map(v => <VerificationCard key={v.id} item={v} onApprove={() => handleApprove(v)} onReject={() => handleReject(v)} />)}</>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6366f1" colors={['#6366f1']} />}>
          <Text style={s.listHint}>{users.length} users - tap to expand</Text>
          {users.map(u => <UserRow key={u.id} user={u} userItems={enriched.filter(i => i.user_id === u.id)} onRole={applyRole} onTier={applyTier} />)}
          {!users.length && <View style={s.center}><Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text><Text style={{ color: '#475569', textAlign: 'center', lineHeight: 22 }}>No users found.{'\n'}Run 007_admin_rpc.sql to enable full access.</Text></View>}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  headerSub: { color: '#6366f1', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: '#f1f5f9', borderRadius: 14, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabBtnText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  tabBtnTextActive: { color: '#6366f1' },
  verifyCard: { backgroundColor: '#ffffff', borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#6366f1', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, overflow: 'hidden' },
  verifyImgBox: { width: '100%', height: 200, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  verifyImg: { width: '100%', height: '100%' },
  verifyInfo: { padding: 16, paddingBottom: 8 },
  verifyEmail: { color: '#0f172a', fontWeight: '800', fontSize: 15, marginBottom: 2 },
  verifyName: { color: '#64748b', fontSize: 13, marginBottom: 10 },
  verifyMetaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  verifyMetaKey: { color: '#94a3b8', fontSize: 13 },
  verifyMetaVal: { color: '#0f172a', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },
  verifyActions: { flexDirection: 'row', gap: 10, padding: 14 },
  verifyBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', borderWidth: 1.5 },
  verifyBtnApprove: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  verifyBtnReject: { backgroundColor: '#fff1f2', borderColor: '#fca5a5' },
  verifyBtnApproveText: { color: '#15803d', fontWeight: '800', fontSize: 14 },
  verifyBtnRejectText: { color: '#dc2626', fontWeight: '800', fontSize: 14 },
  headerTitle: { color: '#0f172a', fontSize: 26, fontWeight: '900', marginTop: 2 },
  closeBtn2: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  statCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statNum: { fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  warn: { marginHorizontal: 20, backgroundColor: 'rgba(234,179,8,0.1)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)', borderRadius: 12, padding: 10, marginBottom: 8 },
  listHint: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  userCard: { backgroundColor: '#ffffff', borderRadius: 20, marginBottom: 2, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  userAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  expandBody: { backgroundColor: '#ffffff', borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginBottom: 10, padding: 16 },
  sectionLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  itemRow: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalBg: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 44, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalSub: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  modalTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  mapContainer: { height: 200, borderRadius: 20, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#e2e8f0' },
  mapOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.9)', borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: 10, alignItems: 'center' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  cardLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowKey: { color: '#475569', fontSize: 13 },
  rowVal: { color: '#0f172a', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(225,29,72,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
});
