import { View, Text, TouchableOpacity } from 'react-native';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { PLAN_LIMITS } from '../../lib/constants';

type TagType = 'nfc_only' | 'nfc_ble' | 'ble_only';

interface TagTypeSelectorProps {
  selectedType: TagType;
  onSelect: (type: TagType) => void;
  onLockedSelect: (requiredTier: string) => void;
}

export default function TagTypeSelector({ selectedType, onSelect, onLockedSelect }: TagTypeSelectorProps) {
  const { tier } = useSubscriptionStore();
  const allowedTypes = PLAN_LIMITS[tier]?.tagTypes || ['nfc_only'];

  const options: Array<{ id: TagType, label: string, requiredTier: string }> = [
    { id: 'nfc_only', label: 'NFC Sticker', requiredTier: 'basic' },
    { id: 'nfc_ble', label: 'NFC + BLE Combo', requiredTier: 'pro' },
    { id: 'ble_only', label: 'BLE Beacon Only', requiredTier: 'max' },
  ];

  return (
    <View className="mb-6">
      <Text className="text-gray-700 font-semibold mb-2">Tag Type</Text>
      <View className="flex-row gap-2">
        {options.map((opt) => {
          const isAllowed = allowedTypes.includes(opt.id);
          const isSelected = selectedType === opt.id;
          
          return (
            <TouchableOpacity
              key={opt.id}
              className={`flex-1 p-3 rounded-lg border items-center justify-center ${
                isSelected 
                  ? 'bg-primary border-primary' 
                  : isAllowed 
                    ? 'bg-white border-gray-300' 
                    : 'bg-gray-100 border-gray-200 opacity-60'
              }`}
              onPress={() => isAllowed ? onSelect(opt.id) : onLockedSelect(opt.requiredTier)}
            >
              <Text className={`font-medium text-center text-sm ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                {opt.label}
              </Text>
              {!isAllowed && (
                <Text className="text-xs text-primary font-bold mt-1">Upgrade</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
