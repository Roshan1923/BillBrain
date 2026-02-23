import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/utils/api';
import { Colors } from '../../src/constants/theme';

type Receipt = {
  receipt_id: string;
  merchant_name: string;
  date: string;
  total: number;
  tax: number;
  section: string;
  category_id: string;
  category_name?: string;
  payment_method: string;
  has_image?: boolean;
};

const SECTIONS = ['all', 'personal', 'business'];

export default function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState('all');
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await api.get('/categories');
      const map: Record<string, string> = {};
      cats.forEach((c: any) => { map[c.category_id] = c.name; });
      setCategories(map);
    } catch {}
  }, []);

  const fetchReceipts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (section !== 'all') params.set('section', section);
      if (search) params.set('search', search);
      const data = await api.get(`/receipts?${params.toString()}`);
      setReceipts(data.receipts || []);
      setTotalCount(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [section, search]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { setLoading(true); fetchReceipts(); }, [fetchReceipts]);

  const onRefresh = () => { setRefreshing(true); fetchReceipts(); };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/receipts/${id}`);
      setReceipts(prev => prev.filter(r => r.receipt_id !== id));
    } catch {}
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const renderReceipt = ({ item }: { item: Receipt }) => (
    <View style={styles.receiptCard} testID={`receipt-card-${item.receipt_id}`}>
      <View style={[styles.sectionStripe, { backgroundColor: item.section === 'personal' ? Colors.primaryLight : Colors.business }]} />
      <View style={styles.receiptContent}>
        <View style={styles.receiptTop}>
          <View style={styles.receiptInfo}>
            <Text style={styles.merchant} numberOfLines={1}>{item.merchant_name}</Text>
            <Text style={styles.receiptMeta}>{item.date}</Text>
          </View>
          <View style={styles.receiptRight}>
            <Text style={styles.amount}>{fmt(item.total)}</Text>
            {item.tax > 0 && <Text style={styles.tax}>Tax: {fmt(item.tax)}</Text>}
          </View>
        </View>
        <View style={styles.receiptBottom}>
          <View style={[styles.badge, item.section === 'personal' ? styles.personalBadge : styles.businessBadge]}>
            <Text style={[styles.badgeText, item.section === 'personal' ? styles.personalBadgeText : styles.businessBadgeText]}>
              {item.section}
            </Text>
          </View>
          <Text style={styles.categoryText} numberOfLines={1}>{categories[item.category_id] || ''}</Text>
          <TouchableOpacity testID={`delete-receipt-${item.receipt_id}`} onPress={() => handleDelete(item.receipt_id)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Receipts</Text>
        <Text style={styles.count}>{totalCount} total</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.dark.textTertiary} />
        <TextInput
          testID="receipt-search-input"
          style={styles.searchInput}
          placeholder="Search merchants..."
          placeholderTextColor={Colors.dark.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Section Filters */}
      <View style={styles.filterRow}>
        {SECTIONS.map(s => (
          <TouchableOpacity
            key={s}
            testID={`filter-${s}`}
            style={[styles.filterPill, section === s && styles.filterPillActive]}
            onPress={() => setSection(s)}
          >
            <Text style={[styles.filterText, section === s && styles.filterTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Receipt List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondary} /></View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={item => item.receipt_id}
          renderItem={renderReceipt}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={Colors.dark.textTertiary} />
              <Text style={styles.emptyText}>No receipts found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.white },
  count: { fontSize: 13, color: Colors.dark.textSecondary },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 8, borderWidth: 1, borderColor: Colors.dark.border },
  searchInput: { flex: 1, color: Colors.white, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.border },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary },
  filterTextActive: { color: Colors.white },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  receiptCard: { flexDirection: 'row', backgroundColor: Colors.dark.card, borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: Colors.dark.border },
  sectionStripe: { width: 4 },
  receiptContent: { flex: 1, padding: 14, gap: 8 },
  receiptTop: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptInfo: { flex: 1, gap: 2 },
  merchant: { fontSize: 15, fontWeight: '600', color: Colors.white },
  receiptMeta: { fontSize: 12, color: Colors.dark.textSecondary },
  receiptRight: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: Colors.white },
  tax: { fontSize: 11, color: Colors.dark.textTertiary },
  receiptBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  personalBadge: { backgroundColor: Colors.personal.bg },
  businessBadge: { backgroundColor: Colors.businessBadge.bg },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  personalBadgeText: { color: Colors.personal.text },
  businessBadgeText: { color: Colors.businessBadge.text },
  categoryText: { flex: 1, fontSize: 12, color: Colors.dark.textTertiary },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.dark.textSecondary },
});
