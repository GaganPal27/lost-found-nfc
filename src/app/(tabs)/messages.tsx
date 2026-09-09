import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MessagesList } from '../messages-list';
import { useTabBarClearance } from '../../components/FloatingTabBar';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#6366f1', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.hDecor1} />
        <View style={styles.hDecor2} />
        <Text style={styles.headerSup}>INBOX</Text>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSub}>Your conversations & claims</Text>
      </LinearGradient>

      {/* List */}
      <MessagesList bottomPadding={tabBarClearance} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  hDecor1: {
    position: 'absolute', top: -30, right: -20,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  hDecor2: {
    position: 'absolute', bottom: -40, left: -30,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerSup: {
    color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
  },
  headerTitle: {
    color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500', marginTop: 2,
  },
});
