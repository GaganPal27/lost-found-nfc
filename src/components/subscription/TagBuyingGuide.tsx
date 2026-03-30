import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SubscriptionTier } from '../../lib/revenuecat';
import { PLAN_LIMITS } from '../../lib/constants';

interface TagBuyingGuideProps {
  visible: boolean;
  tier: SubscriptionTier;
  onDismiss: () => void;
}

export default function TagBuyingGuide({ visible, tier, onDismiss }: TagBuyingGuideProps) {
  const guideText = PLAN_LIMITS[tier]?.tagBuyingGuide || '';

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 pb-12 shadow-xl">
          <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />
          
          <Text className="text-2xl font-bold text-gray-900 mb-2">Next Steps</Text>
          <Text className="text-gray-600 mb-6 text-lg">
            To use your new features, you'll need the right NFC or BLE tags.
          </Text>

          <View className="bg-gray-100 p-4 rounded-xl border border-gray-200 mb-6">
            <Text className="text-gray-800 font-medium text-lg text-center">
              {guideText}
            </Text>
          </View>

          <TouchableOpacity
            className="w-full bg-primary p-4 rounded-xl items-center"
            onPress={onDismiss}
          >
            <Text className="text-white text-lg font-bold">I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
