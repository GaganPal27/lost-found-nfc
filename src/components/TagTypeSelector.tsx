import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSubscriptionStore } from '../stores/subscriptionStore';

type TagType = 'nfc_only' | 'nfc_ble' | 'ble_only';

interface Props {
  selectedType: TagType;
  onSelect: (t: TagType) => void;
  onLockedSelect?: (requiredTier: string) => void;
}

const TAG_OPTIONS = [
  {
    id: 'nfc_only' as TagType,
    label: 'NFC Only',
    icon: '📱',
    desc: 'Sticker tag on your item. Any phone can scan it to get your contact info instantly.',
    requiredTier: 'basic',
    badge: 'Premium',
  },
];

const TIER_RANK: Record<string, number> = { basic: 0, pro: 1, max: 2 };

export default function TagTypeSelector({ selectedType, onSelect, onLockedSelect }: Props) {
  const { tier } = useSubscriptionStore();

  const isLocked = (opt: typeof TAG_OPTIONS[0]) => TIER_RANK[tier] < TIER_RANK[opt.requiredTier];

  return (
    <View>
      <Text style={styles.sectionTitle}>Tag Type</Text>
      {TAG_OPTIONS.map(opt => {
        const locked = isLocked(opt);
        const selected = selectedType === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.88}
            onPress={() => locked ? onLockedSelect?.(opt.requiredTier) : onSelect(opt.id)}
            style={[
              styles.card,
              selected ? styles.cardSelected : styles.cardDefault,
              locked && styles.cardLocked
            ]}
          >
            {/* Icon */}
            <View style={[styles.iconBox, selected ? styles.iconBoxSelected : styles.iconBoxDefault]}>
              <Text style={styles.icon}>{opt.icon}</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <View style={styles.headerRow}>
                <Text style={[styles.label, selected ? styles.labelSelected : styles.labelDefault]}>
                  {opt.label}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{opt.badge}</Text>
                </View>
                {locked && <Text style={styles.lockIcon}>🔒</Text>}
              </View>
              <Text style={[styles.desc, selected ? styles.descSelected : styles.descDefault]}>
                {opt.desc}
              </Text>
            </View>

            {/* Radio Circle */}
            <View style={styles.radioWrap}>
              <View style={[styles.radioOutline, selected ? styles.radioSelected : styles.radioDefault]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
  },
  cardDefault: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#818cf8',
    shadowColor: '#6366f1',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardLocked: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },

  iconBox: {
    width: 48, height: 48,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
  },
  iconBoxDefault: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  iconBoxSelected: { backgroundColor: '#ffffff', borderColor: '#c7d2fe' },
  icon: { fontSize: 24 },

  content: { flex: 1, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  label: { fontWeight: '800', fontSize: 16, marginRight: 8 },
  labelDefault: { color: '#334155' },
  labelSelected: { color: '#0f172a' },
  
  badge: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#16a34a',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockIcon: { fontSize: 12, marginLeft: 8 },

  desc: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  descDefault: { color: '#64748b' },
  descSelected: { color: '#475569' },

  radioWrap: { justifyContent: 'center', paddingLeft: 12 },
  radioOutline: {
    width: 22, height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDefault: { borderColor: '#cbd5e1' },
  radioSelected: { borderColor: '#6366f1' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1' },
});
