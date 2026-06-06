import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout } from 'react-native-maps'; // No PROVIDER_GOOGLE — uses Apple Maps on iOS, default on Android
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BleMapScreen() {
  const router = useRouter();
  const { user, dbUser } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMapItems() {
      try {
        // Use dbUser.id (the users table PK) not user.id (auth UUID)
        const uid = dbUser?.id;
        if (!uid) { setLoading(false); return; }

        const { data, error: fetchErr } = await supabase
          .from('items')
          .select('id, item_name, category, last_seen_lat, last_seen_lng, last_seen_at, status')
          .eq('user_id', uid)
          .not('last_seen_lat', 'is', null)
          .not('last_seen_lng', 'is', null)
          .neq('status', 'deleted');

        if (fetchErr) throw fetchErr;
        setItems(data || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load items');
      } finally {
        setLoading(false);
      }
    }
    fetchMapItems();
  }, [dbUser?.id]);

  // Use device's current locale for center, or first item's coords
  const initialRegion = items.length > 0 ? {
    latitude: items[0].last_seen_lat,
    longitude: items[0].last_seen_lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  } : {
    // Default to New Delhi as fallback (more relevant for Indian users)
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tag Map</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ marginTop: 12, color: '#64748b', fontSize: 14 }}>Locating your tags...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Map Unavailable</Text>
          <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
          <Text style={{ color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 8 }}>No locations yet</Text>
          <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 }}>
            Your items will appear here once they've been scanned or detected by the network.
          </Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          // No PROVIDER_GOOGLE — avoids the need for a Google Maps API key
          // Uses Apple Maps on iOS and AOSP maps on Android by default
          showsUserLocation
          showsMyLocationButton
        >
          {items.map(item => (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.last_seen_lat, longitude: item.last_seen_lng }}
              title={item.item_name}
              description={`Last seen: ${new Date(item.last_seen_at).toLocaleString()}`}
            >
              <View style={styles.markerCircle}>
                <Text style={styles.markerIcon}>📡</Text>
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{item.item_name}</Text>
                  <Text style={styles.calloutSubtitle}>{item.category}</Text>
                  <Text style={styles.calloutTime}>
                    Last seen: {new Date(item.last_seen_at).toLocaleString()}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Info overlay — only shown when map is visible */}
      {!loading && !error && items.length > 0 && (
        <View style={[styles.overlay, { bottom: insets.bottom + 16 }]}>
          <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.maxBadge}>
            <Text style={styles.maxBadgeText}>MAX TIER EXCLUSIVE</Text>
          </LinearGradient>
          <Text style={styles.overlayText}>
            Tracking {items.length} item{items.length !== 1 ? 's' : ''} passively via the network.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  header: { 
    flexDirection: 'row', alignItems: 'center', paddingBottom: 16, 
    paddingHorizontal: 24, backgroundColor: 'white', zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 3
  },
  backBtn: { marginRight: 16, padding: 4 },
  backText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  markerCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#3b82f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  markerIcon: { fontSize: 20 },
  callout: {
    backgroundColor: 'white', padding: 14, borderRadius: 14, width: 210,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 6,
  },
  calloutTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  calloutSubtitle: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  calloutTime: { fontSize: 11, color: '#3b82f6', fontWeight: '700' },
  overlay: {
    position: 'absolute', left: 24, right: 24,
    backgroundColor: 'white', padding: 18, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  maxBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8,
  },
  maxBadgeText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  overlayText: { fontSize: 14, color: '#334155', lineHeight: 20, fontWeight: '500' },
});
