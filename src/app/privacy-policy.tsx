import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StatusBar,
  Animated, StyleSheet, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';

const LAST_UPDATED   = '15 June 2025';
const GRIEVANCE_EMAIL = 'gaganpal101722@gmail.com'; // TODO: swap to dedicated privacy@ email
const ENTITY_NAME    = 'Gaganpal'; // TODO: update to legal entity name

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const Para = ({ children }: { children: string }) => (
    <Text style={styles.para}>{children}</Text>
  );

  const Bullet = ({ children }: { children: string }) => (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeIn }}>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🔒</Text>
            <Text style={styles.heroTitle}>Poki Lost & Found</Text>
            <Text style={styles.heroSub}>Privacy Policy</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>DPDP Act 2023 Compliant</Text>
            </View>
            <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>
          </View>

          {/* Intro */}
          <Section title="1. Who We Are">
            <Para>
              {`This app is operated by ${ENTITY_NAME} ("we", "us", or "our"). We are a Data Fiduciary under the Digital Personal Data Protection Act 2023 (India). We are committed to protecting your personal data and being transparent about how we use it.`}
            </Para>
            <Para>
              {'If you have any questions about this policy, you can contact our Grievance Officer at any time (details in Section 10).'}
            </Para>
          </Section>

          <Section title="2. What Data We Collect">
            <Para>{'We only collect data that is necessary for the app to function. Here is exactly what we collect:'}</Para>
            <Bullet>{'Full name and email address — when you create an account'}</Bullet>
            <Bullet>{'Your GPS location (latitude/longitude) — only when you use Community features like lost item alerts. We do not track your location in the background without your explicit consent.'}</Bullet>
            <Bullet>{'Photos of your registered items — uploaded voluntarily by you'}</Bullet>
            <Bullet>{'Device push notification token — to send you alerts about your items'}</Bullet>
            <Bullet>{'Subscription and billing information — handled entirely by RevenueCat. We never see or store your card details.'}</Bullet>
            <Bullet>{'Messages sent in group chats and item recovery conversations'}</Bullet>
          </Section>

          <Section title="3. Why We Collect It (Purposes)">
            <Para>{'We use your data only for the following specific purposes:'}</Para>
            <Bullet>{'Account creation and authentication — to let you sign in securely'}</Bullet>
            <Bullet>{'Item tracking and recovery — to help you find your lost belongings'}</Bullet>
            <Bullet>{'Community alerts — to notify nearby users when a lost item is reported in their area'}</Bullet>
            <Bullet>{'Push notifications — to tell you when your item is found or someone contacts you'}</Bullet>
            <Bullet>{'Payment processing — to manage your subscription plan via RevenueCat'}</Bullet>
            <Para>{'We do not use your data for advertising. We do not sell your data to third parties. Ever.'}</Para>
          </Section>

          <Section title="4. How Long We Keep Your Data (Retention)">
            <Para>{'We keep your data for as long as your account is active.'}</Para>
            <Bullet>{'Active accounts: data is retained until you delete your account'}</Bullet>
            <Bullet>{'After account deletion: all personal data is permanently erased within 30 days'}</Bullet>
            <Bullet>{'Location data: we only store your last known coordinates. These are overwritten every time the app updates your location. We do not store a history of where you have been.'}</Bullet>
            <Bullet>{'Messages: permanently deleted within 30 days of account deletion'}</Bullet>
          </Section>

          <Section title="5. Who We Share Your Data With">
            <Para>{'We use the following trusted third-party services (sub-processors) to run this app:'}</Para>
            <Bullet>{'Supabase (supabase.com) — our database and authentication provider. Your data is stored on Supabase servers (AWS ap-south-1, Mumbai region). Supabase is GDPR compliant and has signed a Data Processing Agreement with us.'}</Bullet>
            <Bullet>{'RevenueCat (revenuecat.com) — handles subscription and payment processing. They only receive anonymised user IDs and subscription status. They do not receive your name or email.'}</Bullet>
            <Bullet>{'Expo / EAS (expo.dev) — used to build and deliver the app to your device. Expo does not receive any of your personal data at runtime.'}</Bullet>
            <Para>{'We do not share your data with any other company, government body, or individual without your consent, except where required by Indian law.'}</Para>
          </Section>

          <Section title="6. Your Rights Under the DPDP Act 2023">
            <Para>{'As a Data Principal under the DPDP Act 2023, you have the following rights:'}</Para>
            <Bullet>{'Right to Access — you can request a summary of what personal data we hold about you'}</Bullet>
            <Bullet>{'Right to Correction — you can correct your name and other details directly in the app'}</Bullet>
            <Bullet>{'Right to Erasure — you can permanently delete your account and all associated data from the Profile screen'}</Bullet>
            <Bullet>{'Right to Withdraw Consent — you can withdraw your consent at any time. Withdrawing location consent disables community radius alerts. Withdrawing communications consent disables push notifications.'}</Bullet>
            <Bullet>{'Right to Grievance — you can file a complaint with our Grievance Officer (see Section 10)'}</Bullet>
          </Section>

          <Section title="7. How We Protect Your Data">
            <Bullet>{'All data is transmitted over encrypted HTTPS connections'}</Bullet>
            <Bullet>{'Passwords are never stored — Supabase uses bcrypt hashing'}</Bullet>
            <Bullet>{'Row Level Security (RLS) is enforced on the database — users can only read their own data'}</Bullet>
            <Bullet>{'Your location coordinates are only visible to the community within the radius you choose'}</Bullet>
            <Bullet>{'Account deletion triggers immediate erasure — we do not archive deleted accounts'}</Bullet>
          </Section>

          <Section title="8. Children's Data (Under 18)">
            <Para>
              {'This app is intended for users who are 18 years of age or older. We do not knowingly collect personal data from children under 18. At signup, we require an explicit age declaration confirming you are 18 or above.\n\nIf you believe a child has registered without parental consent, please contact our Grievance Officer immediately and we will delete the account.'}
            </Para>
          </Section>

          <Section title="9. Changes to This Policy">
            <Para>
              {'If we make significant changes to this privacy policy, we will notify you via the app with at least 15 days notice before the changes take effect. Continued use of the app after that date constitutes acceptance of the updated policy.\n\nYou can always find the latest version of this policy in your Profile screen.'}
            </Para>
          </Section>

          {/* Grievance Officer — highlighted box */}
          <View style={styles.grievanceBox}>
            <Text style={styles.grievanceTitle}>10. Grievance Officer</Text>
            <Para>
              {'As required under Section 13 of the Digital Personal Data Protection Act 2023, we have designated a Grievance Officer to address your concerns.'}
            </Para>
            <View style={styles.grievanceCard}>
              <Text style={styles.grievanceLabel}>Name</Text>
              <Text style={styles.grievanceValue}>{ENTITY_NAME}</Text>
              <Text style={styles.grievanceLabel}>Email</Text>
              <TouchableOpacity onPress={() => Linking.openURL(`mailto:${GRIEVANCE_EMAIL}`)}>
                <Text style={[styles.grievanceValue, styles.grievanceLink]}>{GRIEVANCE_EMAIL}</Text>
              </TouchableOpacity>
              <Text style={styles.grievanceLabel}>Response Commitment</Text>
              <Text style={styles.grievanceValue}>{'We will acknowledge your grievance within 72 hours and resolve it within 30 days, as required by the DPDP Act 2023.'}</Text>
              <Text style={styles.grievanceLabel}>How to File a Grievance</Text>
              <Text style={styles.grievanceValue}>{'Email us with the subject line: "Privacy Grievance — [your issue]". Include your registered email address and a description of the concern.'}</Text>
            </View>
          </View>

          <Text style={styles.footer}>
            {`This policy is governed by the Digital Personal Data Protection Act 2023 (India) and the Information Technology Act 2000. Last updated: ${LAST_UPDATED}.`}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backBtn: { width: 60 },
  backTxt: { color: '#6366f1', fontWeight: '600', fontSize: 15 },
  headerTitle: { color: '#0f172a', fontWeight: '900', fontSize: 17 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 24 },
  hero: {
    backgroundColor: '#6366f1', borderRadius: 24, padding: 28,
    alignItems: 'center', marginBottom: 24,
  },
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 12 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  updated: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  section: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  sectionTitle: {
    color: '#0f172a', fontWeight: '900', fontSize: 16, marginBottom: 12,
  },
  para: { color: '#475569', fontSize: 14, lineHeight: 22, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', marginBottom: 8, paddingRight: 8 },
  bulletDot: { color: '#6366f1', fontSize: 16, marginRight: 8, marginTop: 2 },
  bulletText: { flex: 1, color: '#475569', fontSize: 14, lineHeight: 22 },
  grievanceBox: {
    backgroundColor: '#eff6ff', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 2, borderColor: '#6366f1',
  },
  grievanceTitle: {
    color: '#1e1b4b', fontWeight: '900', fontSize: 16, marginBottom: 12,
  },
  grievanceCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 10,
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  grievanceLabel: {
    color: '#6366f1', fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 12, marginBottom: 4,
  },
  grievanceValue: { color: '#1e293b', fontSize: 14, lineHeight: 22 },
  grievanceLink: { color: '#6366f1', textDecorationLine: 'underline' },
  footer: {
    color: '#94a3b8', fontSize: 11, textAlign: 'center',
    lineHeight: 18, marginTop: 8, marginBottom: 20, paddingHorizontal: 8,
  },
});
