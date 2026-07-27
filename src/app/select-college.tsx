import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, SafeAreaView, Platform, KeyboardAvoidingView, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

type College = {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
};

export default function SelectCollegeScreen() {
  const router = useRouter();
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setColleges(data || []);
    } catch (err) {
      console.error('Failed to fetch colleges', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollege = async (college: College | null) => {
    try {
      if (college) {
        await AsyncStorage.setItem('selectedCollegeId', college.id);
        await AsyncStorage.setItem('selectedCollegeName', college.name);
      } else {
        setShowRequestModal(true);
        return; // Wait for them to submit the request
      }
      
      // Navigate to onboarding next (or login if they've seen it)
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

  const filteredColleges = colleges.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      
      // Save locally as 'other' and proceed
      await AsyncStorage.setItem('selectedCollegeId', 'other');
      await AsyncStorage.setItem('selectedCollegeName', requestName.trim());
      
      setShowRequestModal(false);
      Alert.alert(
        'Request Sent!',
        'We will add your college shortly. You can still use the app in the meantime.',
        [
          { 
            text: 'Continue', 
            onPress: async () => {
              const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
              if (hasSeen === 'true') {
                router.replace('/login');
              } else {
                router.replace('/onboarding');
              }
            } 
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to submit request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const renderItem = ({ item }: { item: College }) => (
    <TouchableOpacity 
      style={styles.collegeItem}
      onPress={() => handleSelectCollege(item)}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="school" size={24} color="#6366f1" />
      </View>
      <View style={styles.collegeInfo}>
        <Text style={styles.collegeName}>{item.name}</Text>
        {item.domain && <Text style={styles.collegeDomain}>{item.domain}</Text>}
      </View>
      <Feather name="chevron-right" size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.headerArea}
        >
          <Text style={styles.headerTitle}>Find Your Campus</Text>
          <Text style={styles.headerSubtitle}>Join your college community to connect with peers for lost & found.</Text>
          
          <View style={styles.searchContainer}>
            <Feather name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for your college..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </LinearGradient>

        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredColleges}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={() => (
                <TouchableOpacity 
                  style={[styles.collegeItem, styles.otherItem]}
                  onPress={() => handleSelectCollege(null)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: '#f1f5f9' }]}>
                    <Feather name="map-pin" size={24} color="#64748b" />
                  </View>
                  <View style={styles.collegeInfo}>
                    <Text style={[styles.collegeName, { color: '#475569' }]}>Other / My college isn't listed</Text>
                    <Text style={styles.collegeDomain}>We'll help you set it up later</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#cbd5e1" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showRequestModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Your College</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              We'll set up an official community for your college. Let us know its name.
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="College / University Name *"
              placeholderTextColor="#94a3b8"
              value={requestName}
              onChangeText={setRequestName}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Your Email (Optional)"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={requestEmail}
              onChangeText={setRequestEmail}
            />
            <Text style={styles.modalHint}>We'll email you once it's added.</Text>

            <TouchableOpacity 
              style={[styles.submitButton, submittingRequest && { opacity: 0.7 }]} 
              onPress={handleSubmitRequest}
              disabled={submittingRequest}
            >
              {submittingRequest ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerArea: {
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 12,
  },
  modalHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 24,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    height: '100%',
  },
  listContainer: {
    flex: 1,
  },
  collegeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  otherItem: {
    borderWidth: 2,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    shadowOpacity: 0,
    elevation: 0,
    marginTop: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  collegeInfo: {
    flex: 1,
  },
  collegeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  collegeDomain: {
    fontSize: 13,
    color: '#64748b',
  },
});
