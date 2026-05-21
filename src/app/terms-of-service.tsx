import { useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account on the Lost & Found NFC platform ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use this App. We reserve the right to modify these Terms at any time; continued use after changes constitutes acceptance.`,
  },
  {
    title: '2. Data Collection & Privacy',
    body: `When you use the App, we collect:
• Account information (name, email address)
• Item registration data (item name, category, description, photos)
• NFC tag identifiers (hardware UIDs or programmed tag URLs)
• Location data — only captured at the moment an NFC tag is scanned, and only if you explicitly grant permission. We do not continuously track your location.
• Device push notification tokens for sending alerts

Location data is shared only with the registered owner of the scanned item. We do not sell your data to third parties.`,
  },
  {
    title: '3. NFC Tag Usage',
    body: `The App supports two types of NFC tag registration:

(a) Programmed Blank Tags: A web URL is written to an NFC sticker. Any smartphone can read this. By using this feature, you acknowledge that the written URL is publicly accessible to any device that scans it.

(b) Linked Existing Cards: We read and store the hardware identifier (UID) of an existing NFC card (e.g., transit cards, access cards). You represent that you are the authorized owner or user of any card you register. Do not register NFC cards belonging to others without explicit written permission.`,
  },
  {
    title: '4. Finder Connect Feature',
    body: `When a finder scans a registered item, they may choose to share their name, phone number, and approximate location with the item's owner. By using the Finder Connect feature:

• Finders consent to share provided personal details with the item owner
• Owners acknowledge that finder contact information is provided voluntarily and must not be used for harassment, spam, or any unlawful purpose
• Both parties agree to engage respectfully and in good faith`,
  },
  {
    title: '5. Location Sharing',
    body: `Location sharing is strictly opt-in and consent-based:
• Finders are shown a clear consent prompt before any location data is captured
• Location is captured as a single snapshot (not continuous tracking)
• Only a reverse-geocoded area name (e.g., "Saket, Delhi") is shared — exact GPS coordinates are stored securely and never displayed to other users
• You may decline location sharing without affecting other functionality`,
  },
  {
    title: '6. Communications & Messaging',
    body: `The App provides an in-app messaging feature between item owners and finders. You agree not to use messaging to:
• Send spam, unsolicited advertisements, or irrelevant content
• Harass, threaten, or abuse other users
• Share illegal, defamatory, or harmful content
• Collect user data without consent

We reserve the right to terminate accounts that violate these communication standards.`,
  },
  {
    title: '7. Limitation of Liability',
    body: `The App is a communication and notification platform only. We:
• Do NOT guarantee the return of any lost item
• Do NOT verify the identity of finders or owners beyond account registration
• Are NOT responsible for disputes, fraud, or harm arising from interactions between users
• Are NOT liable for any loss, theft, or damage to items registered in the App

Use of this platform is at your own risk.`,
  },
  {
    title: '8. User Responsibilities',
    body: `You are responsible for:
• Maintaining the security of your account credentials
• Ensuring items you register belong to you or you have authority to register
• The accuracy of item descriptions and photographs
• Compliance with all applicable laws in your jurisdiction
• Any actions taken under your account`,
  },
  {
    title: '9. Push Notifications',
    body: `By creating an account, you consent to receive push notifications when:
• A registered item's NFC tag is scanned
• A finder initiates contact regarding one of your items
• Important service updates are available

You can disable notifications at any time in your device's system settings.`,
  },
  {
    title: '10. Governing Law',
    body: `These Terms are governed by the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of courts located in New Delhi, India.`,
  },
  {
    title: '11. Contact',
    body: `For questions about these Terms, privacy concerns, or to report abuse, contact us at:\nsupport@lostandfound.app`,
  },
];

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="px-6 pt-14 pb-5 border-b border-darkBorder">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-4" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-400 text-xs uppercase tracking-widest mb-1">Legal</Text>
        <Text className="text-white text-3xl font-bold">Terms of Service</Text>
        <Text className="text-slate-400 text-sm mt-1">Last updated: April 2026</Text>
      </View>

      <Animated.View style={{ opacity: fadeIn, flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 60 }}>
          {/* Intro banner */}
          <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6">
            <Text className="text-primary font-semibold mb-1">Please Read Carefully</Text>
            <Text className="text-slate-300 text-sm leading-6">
              These terms govern your use of the Lost & Found NFC app. By registering, you agree to all provisions below,
              including those related to data collection, location sharing, and finder-owner communication.
            </Text>
          </View>

          {SECTIONS.map((section, idx) => (
            <View key={idx} className="mb-6">
              <Text className="text-white font-bold text-base mb-2">{section.title}</Text>
              <Text className="text-slate-400 text-sm leading-6">{section.body}</Text>
              {idx < SECTIONS.length - 1 && (
                <View className="h-px bg-darkBorder mt-5" />
              )}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
