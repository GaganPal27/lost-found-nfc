import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabIconProps = {
  focused: boolean;
  icon: string;
  label: string;
};

function TabIcon({ focused, icon, label }: TabIconProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 6,
        paddingBottom: 2,
        minWidth: 60,
      }}
    >
      {focused && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            width: 48,
            height: 3,
            borderRadius: 2,
            backgroundColor: '#06b6d4',
          }}
        />
      )}
      <Text
        style={{
          fontSize: 22,
          marginBottom: 3,
          opacity: focused ? 1 : 0.4,
        }}
      >
        {icon}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '500',
          color: focused ? '#06b6d4' : '#64748b',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
          borderTopWidth: 1,
          height: 64 + (insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 8 : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 8 : 4,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#06b6d4',
        tabBarInactiveTintColor: '#475569',
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="my-items"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="🛡️" label="Items" />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="📡" label="Scan" />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="🔔" label="Alerts" />
          ),
        }}
      />
    </Tabs>
  );
}
