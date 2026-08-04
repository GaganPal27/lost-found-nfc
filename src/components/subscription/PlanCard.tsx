import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface PlanCardProps {
  id: 'basic' | 'pro' | 'max';
  name: string; price: string; period?: string;
  oneLiner: string; badges: string[];
  isPopular?: boolean; selected: boolean;
  onSelect: () => void;
}

const PLAN_STYLES: Record<string, { accent: string; badgeBg: string; badgeText: string }> = {
  basic: { accent: '#cbd5e1', badgeBg: '#f1f5f9', badgeText: '#475569' },
  pro:   { accent: '#6366f1', badgeBg: '#eef2ff', badgeText: '#6366f1'  },
  max:   { accent: '#f43f5e', badgeBg: '#fff1f2', badgeText: '#f43f5e' },
};

export default function PlanCard({
  id, name, price, period = '/mo', oneLiner, badges, isPopular, selected, onSelect,
}: PlanCardProps) {
  const style = PLAN_STYLES[id] || PLAN_STYLES.basic;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onSelect}
      style={[
        styles.card,
        selected ? [styles.cardSelected, { borderColor: style.accent }] : styles.cardUnselected,
        selected && id === 'pro' && { shadowColor: '#6366f1' }
      ]}
    >
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.planName}>{name}</Text>
          <Text style={styles.oneLiner}>{oneLiner}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.priceText}>{price}</Text>
          {price !== 'Free' && <Text style={styles.periodText}>{period}</Text>}
        </View>
      </View>

      <View style={[styles.divider, selected ? { backgroundColor: style.badgeBg } : {}]} />

      <View style={styles.badgeRow}>
        {badges.map((badge, idx) => (
          <View key={idx} style={[styles.badge, { backgroundColor: selected ? style.badgeBg : '#f1f5f9' }]}>
            <Text style={[styles.badgeText, { color: selected ? style.badgeText : '#64748b' }]}>{badge}</Text>
          </View>
        ))}
      </View>

      {selected && <View style={[styles.selectedIndicator, { backgroundColor: style.accent }]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: 1 },
  cardUnselected: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  cardSelected: { backgroundColor: '#f8faff', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  popularBadge: { position: 'absolute', top: -12, right: 20, backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  popularText: { color: '#ffffff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerLeft: { flex: 1, paddingRight: 12 },
  planName: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  oneLiner: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  headerRight: { alignItems: 'flex-end' },
  priceText: { color: '#0f172a', fontSize: 24, fontWeight: '900' },
  periodText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  selectedIndicator: { position: 'absolute', top: 22, left: 20, width: 8, height: 8, borderRadius: 4 },
});
