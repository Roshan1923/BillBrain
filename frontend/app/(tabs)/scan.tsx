import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/utils/api';
import { Colors } from '../../src/constants/theme';

type Category = { category_id: string; name: string; section: string };
type OCRData = {
  merchant_name: string; date: string; total: string;
  tax: string; items: any[]; payment_method: string; error?: string;
};

const MODES = [
  { key: 'camera', icon: 'camera', label: 'Camera' },
  { key: 'upload', icon: 'image', label: 'Gallery' },
  { key: 'manual', icon: 'create', label: 'Manual' },
] as const;

export default function ScanScreen() {
  const [mode, setMode] = useState<'camera' | 'upload' | 'manual'>('manual');
  const [categories, setCategories] = useState<Category[]>([]);
  const [section, setSection] = useState<'personal' | 'business'>('personal');
  const [categoryId, setCategoryId] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [imageBase64, setImageBase64] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [merchantName, setMerchantName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [total, setTotal] = useState('');
  const [tax, setTax] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
  }, []);

  const filteredCategories = categories.filter(c => c.section === section);

  const pickImage = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Alert.alert('Permission Required', `Please grant ${fromCamera ? 'camera' : 'photo library'} access`);
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ['images'] });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageBase64(asset.base64 || '');
        setImageUri(asset.uri);
        // Run OCR
        if (asset.base64) {
          runOCR(asset.base64);
        }
      }
    } catch (e) {
      console.error('Image pick error:', e);
    }
  };

  const runOCR = async (base64: string) => {
    setOcrLoading(true);
    try {
      const data: OCRData = await api.post('/ocr/scan', { image_base64: base64 });
      if (data.error) {
        Alert.alert('OCR Notice', data.error);
      }
      if (data.merchant_name) setMerchantName(data.merchant_name);
      if (data.date) setDate(data.date);
      if (data.total) setTotal(String(data.total));
      if (data.tax) setTax(String(data.tax));
      if (data.payment_method) setPaymentMethod(data.payment_method);
    } catch (e: any) {
      Alert.alert('OCR Error', e.message || 'Failed to process image');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!merchantName.trim() || !total || !categoryId) {
      Alert.alert('Missing Fields', 'Please fill in merchant, total, and category');
      return;
    }
    setSaving(true);
    try {
      await api.post('/receipts', {
        merchant_name: merchantName.trim(),
        date,
        total: parseFloat(total) || 0,
        tax: parseFloat(tax) || 0,
        items: [],
        payment_method: paymentMethod,
        section,
        category_id: categoryId,
        notes,
        image_base64: imageBase64,
      });
      setSuccess(true);
      // Reset form
      setMerchantName(''); setTotal(''); setTax(''); setPaymentMethod('');
      setNotes(''); setImageBase64(''); setImageUri(''); setCategoryId('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  const handleModePress = (m: typeof mode) => {
    setMode(m);
    if (m === 'camera') pickImage(true);
    if (m === 'upload') pickImage(false);
  };

  const selectedCategoryName = categories.find(c => c.category_id === categoryId)?.name || '';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add Receipt</Text>

          {/* Success Banner */}
          {success && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.status.success} />
              <Text style={styles.successText}>Receipt saved successfully!</Text>
            </View>
          )}

          {/* Mode Selector */}
          <View style={styles.modeRow}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.key}
                testID={`mode-${m.key}-btn`}
                style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
                onPress={() => handleModePress(m.key)}
              >
                <Ionicons name={m.icon as any} size={20} color={mode === m.key ? Colors.white : Colors.dark.textSecondary} />
                <Text style={[styles.modeText, mode === m.key && styles.modeTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Image Preview */}
          {imageUri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <TouchableOpacity testID="remove-image-btn" style={styles.removeImageBtn} onPress={() => { setImageUri(''); setImageBase64(''); }}>
                <Ionicons name="close-circle" size={24} color={Colors.status.error} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* OCR Loading */}
          {ocrLoading && (
            <View style={styles.ocrLoading}>
              <ActivityIndicator size="small" color={Colors.secondary} />
              <Text style={styles.ocrLoadingText}>Analyzing receipt...</Text>
            </View>
          )}

          {/* Section Toggle */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Section</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                testID="section-personal-btn"
                style={[styles.toggleBtn, section === 'personal' && styles.togglePersonalActive]}
                onPress={() => { setSection('personal'); setCategoryId(''); }}
              >
                <Ionicons name="person" size={16} color={section === 'personal' ? Colors.white : Colors.primaryLight} />
                <Text style={[styles.toggleText, section === 'personal' && styles.toggleTextActive]}>Personal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="section-business-btn"
                style={[styles.toggleBtn, section === 'business' && styles.toggleBusinessActive]}
                onPress={() => { setSection('business'); setCategoryId(''); }}
              >
                <Ionicons name="briefcase" size={16} color={section === 'business' ? Colors.white : Colors.business} />
                <Text style={[styles.toggleText, section === 'business' && styles.toggleTextActive]}>Business</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Merchant Name</Text>
            <TextInput testID="merchant-input" style={styles.input} value={merchantName} onChangeText={setMerchantName}
              placeholder="Store name" placeholderTextColor={Colors.dark.textTertiary} />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.flex]}>
              <Text style={styles.label}>Date</Text>
              <TextInput testID="date-input" style={styles.input} value={date} onChangeText={setDate}
                placeholder="YYYY-MM-DD" placeholderTextColor={Colors.dark.textTertiary} />
            </View>
            <View style={[styles.fieldGroup, styles.flex]}>
              <Text style={styles.label}>Payment</Text>
              <TextInput testID="payment-input" style={styles.input} value={paymentMethod} onChangeText={setPaymentMethod}
                placeholder="Visa, Cash..." placeholderTextColor={Colors.dark.textTertiary} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.flex]}>
              <Text style={styles.label}>Total (CAD)</Text>
              <TextInput testID="total-input" style={styles.input} value={total} onChangeText={setTotal}
                placeholder="0.00" placeholderTextColor={Colors.dark.textTertiary} keyboardType="decimal-pad" />
            </View>
            <View style={[styles.fieldGroup, styles.flex]}>
              <Text style={styles.label}>Tax (GST/HST)</Text>
              <TextInput testID="tax-input" style={styles.input} value={tax} onChangeText={setTax}
                placeholder="0.00" placeholderTextColor={Colors.dark.textTertiary} keyboardType="decimal-pad" />
            </View>
          </View>

          {/* Category Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity testID="category-picker-btn" style={styles.pickerBtn} onPress={() => setShowCategories(!showCategories)}>
              <Text style={[styles.pickerText, !selectedCategoryName && styles.pickerPlaceholder]}>
                {selectedCategoryName || 'Select category'}
              </Text>
              <Ionicons name={showCategories ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
            {showCategories && (
              <View style={styles.categoryList}>
                {filteredCategories.map(c => (
                  <TouchableOpacity
                    key={c.category_id}
                    testID={`category-option-${c.category_id}`}
                    style={[styles.categoryItem, categoryId === c.category_id && styles.categoryItemActive]}
                    onPress={() => { setCategoryId(c.category_id); setShowCategories(false); }}
                  >
                    <Text style={[styles.categoryItemText, categoryId === c.category_id && styles.categoryItemTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput testID="notes-input" style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes}
              placeholder="Additional notes..." placeholderTextColor={Colors.dark.textTertiary} multiline numberOfLines={3} />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            testID="save-receipt-btn"
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={Colors.white} /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                <Text style={styles.saveText}>Save Receipt</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.white, marginBottom: 20 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 10, marginBottom: 16 },
  successText: { color: Colors.status.success, fontSize: 14, fontWeight: '600' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.border },
  modeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeText: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary },
  modeTextActive: { color: Colors.white },
  imagePreview: { marginBottom: 16, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: 200, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: 8, right: 8 },
  ocrLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: Colors.dark.card, borderRadius: 10, marginBottom: 16 },
  ocrLoadingText: { color: Colors.secondary, fontSize: 13 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary, marginBottom: 6, marginLeft: 2 },
  input: { backgroundColor: Colors.dark.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border, height: 48, paddingHorizontal: 14, color: Colors.white, fontSize: 15 },
  notesInput: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10, backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.border },
  togglePersonalActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleBusinessActive: { backgroundColor: Colors.business, borderColor: Colors.business },
  toggleText: { fontSize: 14, fontWeight: '600', color: Colors.dark.textSecondary },
  toggleTextActive: { color: Colors.white },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.dark.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border, height: 48, paddingHorizontal: 14 },
  pickerText: { color: Colors.white, fontSize: 15 },
  pickerPlaceholder: { color: Colors.dark.textTertiary },
  categoryList: { marginTop: 6, backgroundColor: Colors.dark.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border, maxHeight: 200, overflow: 'hidden' },
  categoryItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  categoryItemActive: { backgroundColor: 'rgba(26,201,255,0.1)' },
  categoryItemText: { color: Colors.dark.textSecondary, fontSize: 14 },
  categoryItemTextActive: { color: Colors.secondary, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, height: 52, borderRadius: 12, marginTop: 8 },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
