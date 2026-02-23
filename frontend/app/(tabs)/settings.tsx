import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/utils/api';
import { Colors } from '../../src/constants/theme';

type Category = { category_id: string; name: string; section: string; is_default: boolean };

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [catSection, setCatSection] = useState<'personal' | 'business'>('personal');
  const [loading, setLoading] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const cats = await api.get('/categories');
      setCategories(cats);
    } catch {}
  };

  const filteredCats = categories.filter(c => c.section === catSection);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const cat = await api.post('/categories', { name: newCatName.trim(), section: catSection });
      setCategories(prev => [...prev, cat]);
      setNewCatName('');
      setShowAddCat(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const updateCategory = async (catId: string) => {
    if (!editCatName.trim()) return;
    try {
      await api.put(`/categories/${catId}`, { name: editCatName.trim() });
      setCategories(prev => prev.map(c => c.category_id === catId ? { ...c, name: editCatName.trim() } : c));
      setEditingCat(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const deleteCategory = async (catId: string, catName: string) => {
    try {
      const res = await api.delete(`/categories/${catId}`);
      if (res.deleted === false) {
        Alert.alert('Warning', `${res.receipt_count} receipts are assigned to "${catName}". Please reassign them first.`);
      } else {
        setCategories(prev => prev.filter(c => c.category_id !== catId));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <View style={styles.infoCard}>
            <Ionicons name="cash-outline" size={20} color={Colors.secondary} />
            <Text style={styles.infoText}>CAD (Canadian Dollar)</Text>
            <Text style={styles.infoSub}>GST/HST supported</Text>
          </View>
        </View>

        {/* Categories Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity testID="add-category-btn" onPress={() => setShowAddCat(true)}>
              <Ionicons name="add-circle" size={24} color={Colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Section Toggle */}
          <View style={styles.catToggleRow}>
            <TouchableOpacity
              testID="cat-section-personal"
              style={[styles.catToggle, catSection === 'personal' && styles.catTogglePersonalActive]}
              onPress={() => setCatSection('personal')}
            >
              <Text style={[styles.catToggleText, catSection === 'personal' && styles.catToggleTextActive]}>Personal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="cat-section-business"
              style={[styles.catToggle, catSection === 'business' && styles.catToggleBusinessActive]}
              onPress={() => setCatSection('business')}
            >
              <Text style={[styles.catToggleText, catSection === 'business' && styles.catToggleTextActive]}>Business</Text>
            </TouchableOpacity>
          </View>

          {/* Category List */}
          {filteredCats.map(cat => (
            <View key={cat.category_id} style={styles.catItem}>
              {editingCat === cat.category_id ? (
                <View style={styles.catEditRow}>
                  <TextInput
                    style={styles.catEditInput}
                    value={editCatName}
                    onChangeText={setEditCatName}
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => updateCategory(cat.category_id)}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.status.success} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingCat(null)}>
                    <Ionicons name="close-circle" size={24} color={Colors.dark.textTertiary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <View style={styles.catActions}>
                    <TouchableOpacity testID={`edit-cat-${cat.category_id}`} onPress={() => { setEditingCat(cat.category_id); setEditCatName(cat.name); }}>
                      <Ionicons name="pencil" size={16} color={Colors.dark.textTertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity testID={`delete-cat-${cat.category_id}`} onPress={() => deleteCategory(cat.category_id, cat.name)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.status.error} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.status.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Add Category Modal */}
        <Modal visible={showAddCat} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Category</Text>
              <TextInput
                testID="new-cat-name-input"
                style={styles.modalInput}
                placeholder="Category name"
                placeholderTextColor={Colors.dark.textTertiary}
                value={newCatName}
                onChangeText={setNewCatName}
                autoFocus
              />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowAddCat(false); setNewCatName(''); }}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="confirm-add-cat-btn" style={styles.modalConfirmBtn} onPress={addCategory}>
                  <Text style={styles.modalConfirmText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.white, marginBottom: 20 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 24 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.white },
  profileEmail: { fontSize: 13, color: Colors.dark.textSecondary },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.dark.border },
  infoText: { fontSize: 14, fontWeight: '600', color: Colors.white, flex: 1 },
  infoSub: { fontSize: 12, color: Colors.dark.textTertiary },
  catToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  catToggle: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.dark.card, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  catTogglePersonalActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catToggleBusinessActive: { backgroundColor: Colors.business, borderColor: Colors.business },
  catToggleText: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary },
  catToggleTextActive: { color: Colors.white },
  catItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.dark.card, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.dark.border },
  catName: { fontSize: 14, color: Colors.white, flex: 1 },
  catActions: { flexDirection: 'row', gap: 12 },
  catEditRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  catEditInput: { flex: 1, color: Colors.white, fontSize: 14, backgroundColor: Colors.dark.surface, borderRadius: 8, paddingHorizontal: 10, height: 36 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.status.error, backgroundColor: 'rgba(239,68,68,0.08)' },
  logoutText: { color: Colors.status.error, fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 24, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  modalInput: { backgroundColor: Colors.dark.surface, borderRadius: 10, height: 44, paddingHorizontal: 14, color: Colors.white, fontSize: 15, borderWidth: 1, borderColor: Colors.dark.border },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  modalCancelText: { color: Colors.dark.textSecondary, fontSize: 15, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary },
  modalConfirmText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
