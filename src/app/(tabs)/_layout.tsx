import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ADDED: The 5th Community Tab is now between Connect and Alerts
const TABS = [
  { name: 'my-items',      icon: '🛡️',  label: 'Items'   },
  { name: 'scan',          icon: '⬡',   label: 'Scan'    },
  { name: 'connect',       icon: '🤝',  label: 'Connect' },
  { name: 'community',     icon: '🗺️',  label: 'Board'   }, 
  { name: 'notifications', icon: '🔔',  label: 'Alerts'  },
];

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    // CHANGED: Reduced minWidth from 60 to 52 to fit 5 tabs
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4, minWidth: 52 }}>
      {focused && (
        <View style={{
          position: 'absolute', top: -12, width: 32, height: 32,
          borderRadius: 16, backgroundColor: 'rgba(99,102,241,0.1)',
          shadowColor: '#6366f1', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
        }} />
      )}
      <Text style={{ fontSize: 21, marginBottom: 3, opacity: focused ? 1 : 0.4 }}>{icon}</Text>
      <Text style={{
        // CHANGED: Reduced fontSize from 9 to 8 to prevent overlap
        fontSize: 8, fontWeight: focused ? '800' : '600',
        color: focused ? '#6366f1' : '#64748b',
        letterSpacing: 0.8, textTransform: 'uppercase',
      }}>{label}</Text>
      {focused && (
        <View style={{ position: 'absolute', bottom: -8, width: 4, height: 4, borderRadius: 2, backgroundColor: '#6366f1' }} />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopColor: '#f1f5f9',
        borderTopWidth: 1,
        height: 68 + (insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 8 : 0),
        paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 8 : 4,
        elevation: 20,
        shadowColor: '#6366f1',
        shadowOpacity: 0.05,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 },
      },
      tabBarShowLabel: false,
      tabBarActiveTintColor: '#6366f1',
      tabBarInactiveTintColor: '#64748b',
      tabBarHideOnKeyboard: true,
    }}>
      {TABS.map(t => (
        <Tabs.Screen key={t.name} name={t.name}
          options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={t.icon} label={t.label} /> }}
        />
      ))}
    </Tabs>
  );
}
