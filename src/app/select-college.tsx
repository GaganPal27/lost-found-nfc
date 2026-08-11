import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, SafeAreaView, Platform,
  KeyboardAvoidingView, Modal, Alert, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type College = {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
};

export default function SelectCollegeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [colleges, setColleges] = useState<College[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      const { data, error } = await supabase.from('colleges').select('*').order('name');
      if (error) throw error;
      setColleges(data || []);
    } catch (err) {
      console.error('Failed to fetch colleges', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredColleges = colleges.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.domain && c.domain.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handlePickCollege = (college: College) => {
    setSelectedCollege(college);
    setShowPickerModal(false);
    setSearchQuery('');
  };

  const handlePickOther = () => {
    setShowPickerModal(false);
    setSearchQuery('');
    setShowRequestModal(true);
  };

  const handleContinue = async () => {
    if (!selectedCollege) {
      Alert.alert('Select a University', 'Please select your university to continue.');
      return;
    }
    try {
      await AsyncStorage.setItem('selectedCollegeId', selectedCollege.id);
      await AsyncStorage.setItem('selectedCollegeName', selectedCollege.name);
      const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
      if (hasSeen === 'true') {
        router.replace('/login');
      } else {
        router.replace('/onboarding');
      }
    } catch (err) {
      console.error('Failed to save college preference', err);
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestName.trim()) {
      Alert.alert('Required', 'Please enter your college name.');
      return;
    }
    setSubmittingRequest(true);
    try {
      const { error } = await supabase.from('college_requests').insert({
        college_name: requestName.trim(),
        email: requestEmail.trim() || null,
      });
      if (error) throw error;

      await AsyncStorage.setItem('selectedCollegeId', 'other');
      await AsyncStorage.setItem('selectedCollegeName', requestName.trim());

      setShowRequestModal(false);
      Alert.alert(
        'Request Sent! 🎉',
        "We'll add your college shortly. You can still use the app in the meantime.",
        [{
          text: 'Continue',
          onPress: async () => {
            const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
            if (hasSeen === 'true') router.replace('/login');
            else router.replace('/onboarding');
          },
        }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to submit request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const renderCollegeRow = ({ item }: { item: College }) => (
    <TouchableOpacity style={styles.collegeRow} onPress={() => handlePickCollege(item)} activeOpacity={0.7}>
      <View style={styles.collegeRowIcon}>
        <Ionicons name="school" size={22} color="#6366f1" />
      </View>
      <View style={styles.collegeRowInfo}>
        <Text style={styles.collegeRowName} numberOfLines={1}>{item.name}</Text>
        {item.domain && <Text style={styles.collegeRowDomain}>{item.domain}</Text>}
      </View>
      <Feather name="chevron-right" size={18} color="#cbd5e1" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}
      >
        <View style={styles.hCircle1} />
        <View style={styles.hCircle2} />
        <View style={styles.logoOrb}>
          <Text style={{ fontSize: 32 }}>🏫</Text>
        </View>
        <Text style={styles.headerTitle}>Find Your Campus</Text>
        <Text style={styles.headerSub}>
          Join your college community to connect{'\n'}with peers for lost & found.
        </Text>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>

        {/* University picker button */}
        <Text style={styles.sectionLabel}>YOUR UNIVERSITY</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowPickerModal(true)} activeOpacity={0.8}>
          <View style={styles.pickerBtnIcon}>
            <Ionicons name="school-outline" size={22} color={selectedCollege ? '#6366f1' : '#94a3b8'} />
          </View>
          <Text style={[styles.pickerBtnText, selectedCollege && styles.pickerBtnTextSelected]} numberOfLines={1}>
            {selectedCollege ? selectedCollege.name : 'Select your university...'}
          </Text>
          <Feather name="chevron-down" size={20} color={selectedCollege ? '#6366f1' : '#94a3b8'} />
        </TouchableOpacity>

        {selectedCollege?.domain && (
          <View style={styles.domainBadge}>
            <Feather name="check-circle" size={14} color="#16a34a" style={{ marginRight: 6 }} />
            <Text style={styles.domainBadgeText}>Email domain: @{selectedCollege.domain}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueBtn, !selectedCollege && styles.continueBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.88}
          disabled={!selectedCollege}
        >
          <LinearGradient
            colors={selectedCollege ? ['#6366f1', '#7c3aed'] : ['#e2e8f0', '#e2e8f0']}
            style={styles.continueBtnGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.continueBtnText, !selectedCollege && { color: '#94a3b8' }]}>
              Continue  →
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.otherLink} onPress={() => setShowRequestModal(true)} activeOpacity={0.7}>
          <Text style={styles.otherLinkText}>
            My university isn't listed{'  '}
            <Text style={{ color: '#6366f1', fontWeight: '700' }}>Request it →</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── University Picker Modal ── */}
      <Modal visible={showPickerModal} animationType="slide" transparent onRequestClose={() => setShowPickerModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Sheet handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select University</Text>
              <TouchableOpacity onPress={() => { setShowPickerModal(false); setSearchQuery(''); }}>
                <Feather name="x" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={styles.sheetSearch}>
              <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.sheetSearchInput}
                placeholder="Search university name or domain..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* College list */}
            {loading ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={filteredColleges}
                keyExtractor={item => item.id}
                renderItem={renderCollegeRow}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingTop: 40 }}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
                    <Text style={{ color: '#64748b', fontWeight: '600', textAlign: 'center' }}>
                      No universities found.{'\n'}Try a different name or request yours below.
                    </Text>
                  </View>
                }
                ListFooterComponent={() => (
                  <TouchableOpacity style={styles.otherRow} onPress={handlePickOther} activeOpacity={0.7}>
                    <View style={[styles.collegeRowIcon, { backgroundColor: '#f1f5f9' }]}>
                      <Feather name="plus-circle" size={22} color="#64748b" />
                    </View>
                    <View style={styles.collegeRowInfo}>
                      <Text style={[styles.collegeRowName, { color: '#475569' }]}>My university isn't listed</Text>
                      <Text style={styles.collegeRowDomain}>Request it — we'll set it up</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#cbd5e1" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Request College Modal ── */}
      <Modal visible={showRequestModal} animationType="slide" transparent onRequestClose={() => setShowRequestModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Request Your College</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Feather name="x" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
                We'll set up an official community for your college. Let us know its name.
              </Text>

              <TextInput
                style={styles.requestInput}
                placeholder="College / University Name *"
                placeholderTextColor="#94a3b8"
                value={requestName}
                onChangeText={setRequestName}
              />
              <TextInput
                style={styles.requestInput}
                placeholder="Your Email (Optional — we'll notify you)"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={requestEmail}
                onChangeText={setRequestEmail}
              />

              <TouchableOpacity
                style={[styles.continueBtn, submittingRequest && { opacity: 0.7 }]}
                onPress={handleSubmitRequest}
                disabled={submittingRequest}
                activeOpacity={0.88}
              >
                <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.continueBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {submittingRequest
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.continueBtnText}>Submit Request</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* Header */
  header: { paddingHorizontal: 24, paddingBottom: 40, overflow: 'hidden', position: 'relative', alignItems: 'center' },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -20, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  logoOrb: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  /* Body */
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  sectionLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },

  /* Picker button */
  pickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16, shadowColor: '#6366f1', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  pickerBtnIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pickerBtnText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#94a3b8' },
  pickerBtnTextSelected: { color: '#0f172a', fontWeight: '700' },

  /* Domain badge */
  domainBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  domainBadgeText: { color: '#16a34a', fontSize: 13, fontWeight: '600' },

  /* Continue button */
  continueBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 24, shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  continueBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  continueBtnGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  /* Other link */
  otherLink: { alignItems: 'center', paddingVertical: 16 },
  otherLinkText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },

  /* Modal overlay */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },

  /* Bottom sheet */
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '85%', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },

  /* Sheet search */
  sheetSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, marginHorizontal: 20, marginVertical: 16, paddingHorizontal: 14, paddingVertical: 12 },
  sheetSearchInput: { flex: 1, fontSize: 15, color: '#0f172a', fontWeight: '500' },

  /* College row in list */
  collegeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  otherRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8faff', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#e2e8f0', marginTop: 4 },
  collegeRowIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  collegeRowInfo: { flex: 1 },
  collegeRowName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  collegeRowDomain: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  /* Request input */
  requestInput: { backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 16, height: 54, fontSize: 15, color: '#0f172a', marginBottom: 12 },
});
