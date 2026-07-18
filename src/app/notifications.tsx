import { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { NotificationsList } from './notifications-list';
import { MessagesList } from './messages-list';

type TabType = 'notifications' | 'messages';

export default function NotificationsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('notifications');

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />

      {/* Unified Header */}
      <View className="px-6 pt-14 pb-4 border-b border-slate-200 bg-white">
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2" activeOpacity={0.7}>
            <Feather name="arrow-left" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text className="text-slate-900 text-2xl font-black">Inbox</Text>
        </View>

        {/* Tab Selector */}
        <View className="flex-row bg-slate-100 rounded-xl p-1">
          <TouchableOpacity
            style={{ flex: 1 }}
            className={`py-2 items-center rounded-lg ${activeTab === 'notifications' ? 'bg-white shadow-sm' : ''}`}
            onPress={() => setActiveTab('notifications')}
            activeOpacity={0.8}
          >
            <Text className={`font-bold ${activeTab === 'notifications' ? 'text-slate-900' : 'text-slate-500'}`}>
              Notifications
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1 }}
            className={`py-2 items-center rounded-lg ${activeTab === 'messages' ? 'bg-white shadow-sm' : ''}`}
            onPress={() => setActiveTab('messages')}
            activeOpacity={0.8}
          >
            <Text className={`font-bold ${activeTab === 'messages' ? 'text-slate-900' : 'text-slate-500'}`}>
              Messages
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1">
        {activeTab === 'notifications' ? <NotificationsList /> : <MessagesList />}
      </View>
    </View>
  );
}
