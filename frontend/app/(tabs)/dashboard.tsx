import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/utils/api';
import { Colors } from '../../src/constants/theme';

type Summary = {
  monthly: { total: number; tax: number; count: number };
  yearly: { total: number; tax: number; count: number };
  sections: Record<string, { total: number; count: number }>;
  categories: Array<{ category_id: string; name: string; total: number; count: number }>;
  recent_receipts: Array<any>;
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.get('/dashboard/summary');
      setSummary(data);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const onRefresh = () => { setRefreshing(true); fetchSummary(); };

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const personalTotal = summary?.sections?.personal?.total || 0;
  const businessTotal = summary?.sections?.business?.total || 0;
  const totalSpend = personalTotal + businessTotal;
  const personalPct = totalSpend > 0 ? (personalTotal / totalSpend) * 100 : 50;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require('../../assets/images/logo-icon.png')} style={styles.headerLogo} resizeMode="contain" />
            <View>
              <View style={styles.headerBrand}>
                <Text style={styles.headerBill}>Bill</Text>
                <Text style={styles.headerBrain}>Brain</Text>
              </View>
              <Text style={styles.subtitle}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
            </View>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        </View>

        {/* Monthly & Yearly Cards */}
        <View style={styles.cardRow}>
          <View style={[styles.statCard, styles.primaryCard]}>
            <Text style={styles.statLabel}>This Month</Text>
            <Text style={styles.statValue}>{fmt(summary?.monthly?.total || 0)}</Text>
            <Text style={styles.statSub}>{summary?.monthly?.count || 0} receipts</Text>
          </View>
          <View style={[styles.statCard, styles.darkCard]}>
            <Text style={styles.statLabel}>Year to Date</Text>
            <Text style={styles.statValue}>{fmt(summary?.yearly?.total || 0)}</Text>
            <Text style={styles.statSub}>{summary?.yearly?.count || 0} receipts</Text>
          </View>
        </View>

        {/* Section Split */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal vs Business</Text>
          <View style={styles.splitCard}>
            <View style={styles.splitRow}>
              <View style={[styles.splitDot, { backgroundColor: Colors.primaryLight }]} />
              <Text style={styles.splitLabel}>Personal</Text>
              <Text style={styles.splitValue}>{fmt(personalTotal)}</Text>
            </View>
            <View style={styles.barContainer}>
              <View style={[styles.barPersonal, { width: `${personalPct}%` }]} />
              <View style={[styles.barBusiness, { width: `${100 - personalPct}%` }]} />
            </View>
            <View style={styles.splitRow}>
              <View style={[styles.splitDot, { backgroundColor: Colors.business }]} />
              <Text style={styles.splitLabel}>Business</Text>
              <Text style={styles.splitValue}>{fmt(businessTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity testID="quick-scan-btn" style={styles.actionBtn} onPress={() => router.push('/(tabs)/scan')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(26,201,255,0.15)' }]}>
                <Ionicons name="camera" size={22} color={Colors.secondary} />
              </View>
              <Text style={styles.actionText}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="quick-upload-btn" style={styles.actionBtn} onPress={() => router.push('/(tabs)/scan')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(34,179,249,0.15)' }]}>
                <Ionicons name="image" size={22} color={Colors.primaryLight} />
              </View>
              <Text style={styles.actionText}>Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="quick-manual-btn" style={styles.actionBtn} onPress={() => router.push('/(tabs)/scan')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                <Ionicons name="create" size={22} color={Colors.business} />
              </View>
              <Text style={styles.actionText}>Manual</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Categories */}
        {summary?.categories && summary.categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Categories</Text>
            <View style={styles.card}>
              {summary.categories.slice(0, 5).map((cat, i) => {
                const maxTotal = summary.categories[0]?.total || 1;
                const pct = (cat.total / maxTotal) * 100;
                return (
                  <View key={cat.category_id} style={styles.catRow}>
                    <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                    <View style={styles.catBarOuter}>
                      <View style={[styles.catBarInner, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.catValue}>{fmt(cat.total)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent Receipts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Receipts</Text>
            <TouchableOpacity testID="view-all-receipts-btn" onPress={() => router.push('/(tabs)/receipts')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {(!summary?.recent_receipts || summary.recent_receipts.length === 0) ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color={Colors.dark.textTertiary} />
              <Text style={styles.emptyText}>No receipts yet</Text>
              <Text style={styles.emptySubText}>Tap the + button to add your first receipt</Text>
            </View>
          ) : (
            summary.recent_receipts.slice(0, 5).map((r) => (
              <View key={r.receipt_id} style={styles.receiptItem}>
                <View style={[styles.receiptDot, { backgroundColor: r.section === 'personal' ? Colors.primaryLight : Colors.business }]} />
                <View style={styles.receiptInfo}>
                  <Text style={styles.receiptMerchant} numberOfLines={1}>{r.merchant_name}</Text>
                  <Text style={styles.receiptDate}>{r.date} · {r.category_name || r.section}</Text>
                </View>
                <Text style={styles.receiptAmount}>{fmt(r.total)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogoCircle: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#050505', borderWidth: 1.5, borderColor: 'rgba(59,155,245,0.25)' },
  headerLogoImage: { width: 44, height: 44 },
  headerBrand: { flexDirection: 'row', alignItems: 'baseline' },
  headerBill: { fontSize: 20, fontWeight: '800', color: '#3B9BF5' },
  headerBrain: { fontSize: 20, fontWeight: '800', color: '#8BA3B8' },
  subtitle: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 1 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, padding: 16, borderRadius: 16, gap: 4 },
  primaryCard: { backgroundColor: Colors.primary },
  darkCard: { backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.border },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.white },
  statSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAll: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },
  splitCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, gap: 10 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitDot: { width: 10, height: 10, borderRadius: 5 },
  splitLabel: { flex: 1, fontSize: 14, color: Colors.dark.textSecondary },
  splitValue: { fontSize: 14, fontWeight: '700', color: Colors.white },
  barContainer: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  barPersonal: { backgroundColor: Colors.primaryLight, height: '100%' },
  barBusiness: { backgroundColor: Colors.business, height: '100%' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.dark.border },
  actionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  card: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, gap: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catName: { width: 80, fontSize: 12, color: Colors.dark.textSecondary },
  catBarOuter: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.dark.surface },
  catBarInner: { height: '100%', borderRadius: 3, backgroundColor: Colors.secondary },
  catValue: { fontSize: 12, fontWeight: '600', color: Colors.white, width: 60, textAlign: 'right' },
  emptyCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.dark.border },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.dark.textSecondary },
  emptySubText: { fontSize: 13, color: Colors.dark.textTertiary, textAlign: 'center' },
  receiptItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.dark.border, gap: 12 },
  receiptDot: { width: 6, height: 32, borderRadius: 3 },
  receiptInfo: { flex: 1, gap: 2 },
  receiptMerchant: { fontSize: 14, fontWeight: '600', color: Colors.white },
  receiptDate: { fontSize: 12, color: Colors.dark.textSecondary },
  receiptAmount: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
