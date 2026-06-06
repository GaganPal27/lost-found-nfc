import { Tabs, useRouter, usePathname } from 'expo-router';
import { View } from 'react-native';
export default function TabsLayout() {
  const router = useRouter();
  const handleTabPress = (route: string) => {
    router.push(`/(tabs)/${route}` as any);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },   // hide native tab bar entirely
        }}
      >
        <Tabs.Screen name="my-items" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="scan" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="connect" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="community" options={{ tabBarButton: () => null }} />
      </Tabs>
    </View>
  );
}
