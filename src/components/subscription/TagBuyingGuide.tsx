import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SubscriptionTier } from '../../stores/subscriptionStore';

interface Props {
  visible: boolean;
  tier: SubscriptionTier;
  onDismiss: () => void;
}

const HARDWARE = {
  basic: {
    title: 'Get Your NFC Tags',
    icon: '🏷️',
    tags: [
      { name: 'NTAG213 Sticker', desc: 'Most compatible. Works with all Android & iPhone 7+.', price: '~$0.50 each', rec: true },
      { name: 'NTAG215 Sticker', desc: 'More memory. Good for writing longer URLs.', price: '~$0.80 each', rec: false },
    ],
  },
  pro: {
    title: 'Get NFC + BLE Hardware',
    icon: '🔗',
    tags: [
      { name: 'NTAG213 NFC Sticker', desc: 'For NFC scanning. Works on all phones with NFC.', price: '~$0.50 each', rec: true },
      { name: 'Minew E6 BLE Beacon', desc: 'Compact BLE beacon, great battery life (1 year+).', price: '~$8 each', rec: true },
    ],
  },
  max: {
    title: 'Get Your BLE Beacons',
    icon: '📡',
    tags: [
      { name: 'Minew E6 BLE Beacon', desc: 'Best value, 1 year battery, waterproof.', price: '~$8 each', rec: true },
      { name: 'Tile Ultra Beacon', desc: 'Premium form factor, replaceable battery.', price: '~$35 each', rec: false },
    ],
  },
};

export default function TagBuyingGuide({ visible, tier, onDismiss }: Props) {
  const guide = HARDWARE[tier] || HARDWARE.basic;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View className="flex-1 justify-end bg-black/70">
        <View className="bg-darkBg border-t border-darkBorder rounded-t-3xl" style={{ paddingBottom: 40 }}>
          {/* Handle */}
          <View className="w-12 h-1 bg-slate-600 rounded-full self-center mt-4 mb-6" />

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
            {/* Header */}
            <View className="flex-row items-center mb-2">
              <Text className="text-4xl mr-4">{guide.icon}</Text>
              <View>
                <Text className="text-white text-xl font-bold">{guide.title}</Text>
                <Text className="text-slate-400 text-sm">Recommended hardware for your plan</Text>
              </View>
            </View>

            <View className="h-px bg-darkBorder my-5" />

            {guide.tags.map((tag, i) => (
              <View
                key={i}
                className={`bg-darkCard border rounded-3xl p-5 mb-4 ${tag.rec ? 'border-cyan-500/30' : 'border-darkBorder'}`}
              >
                {tag.rec && (
                  <View className="bg-primary px-3 py-1 rounded-full self-start mb-3">
                    <Text className="text-slate-900 text-[10px] font-bold uppercase tracking-widest">Recommended</Text>
                  </View>
                )}
                <Text className="text-white font-bold text-base mb-1">{tag.name}</Text>
                <Text className="text-slate-400 text-sm leading-5 mb-3">{tag.desc}</Text>
                <View className="bg-primary/15 border border-primary/25 self-start px-3 py-1 rounded-full">
                  <Text className="text-primary text-sm font-bold">{tag.price}</Text>
                </View>
              </View>
            ))}

            <View className="bg-darkCard border border-darkBorder rounded-3xl p-4 mb-6">
              <Text className="text-slate-400 text-xs leading-5 text-center">
                💡 Available on Amazon, AliExpress, or any NFC/BLE hardware supplier. Search for the product name above.
              </Text>
            </View>

            <TouchableOpacity
              className="w-full bg-primary py-4 rounded-2xl items-center"
              onPress={onDismiss}
              activeOpacity={0.85}
              style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
            >
              <Text className="text-slate-900 font-bold text-lg">Got it — Go to My Items</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
