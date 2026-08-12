import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, SafeAreaView, Platform,
  KeyboardAvoidingView, Modal, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
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
  const inputRef = useRef<TextInput>(null);

  const [colleges, setColleges] = useState<College[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Only show results after 3 characters — like Camu
  const filteredColleges = query.trim().length >= 3
    ? colleges.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.domain && c.domain.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  const shouldShowDropdown = showDropdown && query.trim().length >= 3;

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setShowDropdown(true);
    if (text.trim().length >= 3 && colleges.length === 0) {
      fetchColleges();
    }
  };

  const fetchColleges = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('colleges').select('*').order('name');
      setColleges(data || []);
    } catch (err) {
      console.error('Failed to fetch colleges', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollege = async (college: College) => {
    setQuery(college.name);
    setShowDropdown(false);
    inputRef.current?.blur();
    try {
      await AsyncStorage.setItem('selectedCollegeId', college.id);
      await AsyncStorage.setItem('selectedCollegeName', college.name);
      await AsyncStorage.setItem('selectedCollegeDomain', college.domain ?? '');
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
      Alert.alert('Required', 'Please enter your institution name.');
      return;
    }
    setSubmittingRequest(true);
    try {
      await supabase.from('college_requests').insert({
        college_name: requestName.trim(),
        email: requestEmail.trim() || null,
      });

      await AsyncStorage.setItem('selectedCollegeId', 'other');
      await AsyncStorage.setItem('selectedCollegeName', requestName.trim());
      await AsyncStorage.setItem('selectedCollegeDomain', '');

      setShowRequestModal(false);
      Alert.alert(
        "Request Sent! 🎉",
        "We'll add your institution shortly. You can still use the app in the meantime.",
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

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Select your institution</Text>
          <View style={styles.divider} />
        </View>

        {/* Search field */}
        <View style={styles.body}>
          <Text style={styles.fieldLabel}>Institution</Text>

          <View style={[styles.inputWrap, showDropdown && query.length >= 3 && styles.inputWrapActive]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Type your institution name"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={handleQueryChange}
              onFocus={() => setShowDropdown(true)}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => { setQuery(''); setShowDropdown(false); }}
                style={styles.clearBtn}
                activeOpacity={0.7}
              >
                <Feather name="x" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Hint text — shown when less than 3 chars */}
          {!shouldShowDropdown && (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Please type your institution name to search. You can type the first 3 letters of your institution to see the list.
              </Text>
            </View>
          )}

          {/* Inline dropdown results */}
          {shouldShowDropdown && (
            <View style={styles.dropdown}>
              {loading ? (
                <ActivityIndicator size="small" color="#6366f1" style={{ padding: 20 }} />
              ) : filteredColleges.length === 0 ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No institutions found for "{query}"</Text>
                  <TouchableOpacity
                    onPress={() => { setShowDropdown(false); setShowRequestModal(true); }}
                    activeOpacity={0.7}
                    style={styles.requestInline}
                  >
                    <Text style={styles.requestInlineText}>
                      Request to add your institution →
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 340 }}
                >
                  {filteredColleges.map((college) => (
                    <TouchableOpacity
                      key={college.id}
                      style={styles.dropdownRow}
                      onPress={() => handleSelectCollege(college)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownRowIcon}>
                        <Text style={{ fontSize: 18 }}>🏫</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dropdownRowName} numberOfLines={1}>{college.name}</Text>
                        {college.domain && (
                          <Text style={styles.dropdownRowDomain}>@{college.domain}</Text>
                        )}
                      </View>
                      <Feather name="chevron-right" size={16} color="#cbd5e1" />
                    </TouchableOpacity>
                  ))}

                  {/* "Not listed" row at bottom of results */}
                  <TouchableOpacity
                    style={[styles.dropdownRow, styles.dropdownRowOther]}
                    onPress={() => { setShowDropdown(false); setShowRequestModal(true); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dropdownRowIcon, { backgroundColor: '#f1f5f9' }]}>
                      <Feather name="plus-circle" size={18} color="#64748b" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dropdownRowName, { color: '#475569' }]}>
                        My institution isn't listed
                      </Text>
                      <Text style={styles.dropdownRowDomain}>Request to add it</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#cbd5e1" />
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Request Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequestModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Request Your Institution</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)} activeOpacity={0.7}>
                <Feather name="x" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20 }}>
              <Text style={styles.sheetSub}>
                We'll set up an official community for your institution. Let us know its name and we'll add it shortly.
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Institution / University Name *"
                placeholderTextColor="#94a3b8"
                value={requestName}
                onChangeText={setRequestName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Your Email (Optional — we'll notify you)"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={requestEmail}
                onChangeText={setRequestEmail}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submittingRequest && { opacity: 0.6 }]}
                onPress={handleSubmitRequest}
                disabled={submittingRequest}
                activeOpacity={0.88}
              >
                {submittingRequest
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit Request</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  /* Header */
  header: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 0 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#e2e8f0' },

  /* Body */
  body: { paddingHorizontal: 24, paddingTop: 24, flex: 1 },
  fieldLabel: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 8 },

  /* Search input */
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
    backgroundColor: '#ffffff', paddingHorizontal: 14,
  },
  inputWrapActive: { borderColor: '#6366f1', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  input: { flex: 1, fontSize: 15, color: '#0f172a', paddingVertical: 14, fontWeight: '500' },
  clearBtn: { padding: 4 },

  /* Hint box */
  hintBox: {
    backgroundColor: '#eff6ff', borderRadius: 10,
    padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  hintText: { color: '#1d4ed8', fontSize: 13, lineHeight: 20, fontWeight: '500' },

  /* Dropdown */
  dropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5, borderTopWidth: 0, borderColor: '#6366f1',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6366f1', shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  dropdownRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  dropdownRowOther: { backgroundColor: '#f8faff' },
  dropdownRowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  dropdownRowName: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 1 },
  dropdownRowDomain: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  /* No results */
  noResults: { padding: 20, alignItems: 'center' },
  noResultsText: { color: '#64748b', fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 12 },
  requestInline: { paddingVertical: 8 },
  requestInlineText: { color: '#6366f1', fontSize: 14, fontWeight: '700' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 }, elevation: 16,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  sheetSub: { color: '#64748b', fontSize: 14, lineHeight: 20, marginBottom: 20, marginTop: 16 },
  modalInput: {
    backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 14, paddingHorizontal: 16, height: 54,
    fontSize: 15, color: '#0f172a', marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#6366f1', borderRadius: 16, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
    shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
