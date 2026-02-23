import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, BACKEND_URL } from '../../src/utils/api';
import { Colors } from '../../src/constants/theme';

type TaxSummary = {
  summary: { personal: any[]; business: any[] };
  totals: { personal: { total: number; tax: number; count: number }; business: { total: number; tax: number; count: number } };
};

export default function ReportsScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [data, setData] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/tax-summary?date_from=${dateFrom}&date_to=${dateTo}`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const token = await require('@react-native-async-storage/async-storage').default.getItem('auth_token');
      const url = `${BACKEND_URL}/api/reports/export-csv?date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const csv = await res.text();

      // On web, trigger download
      if (typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `billbrain_report_${year}.csv`;
        link.click();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;

  const changeYear = (delta: number) => {
    const newYear = year + delta;
    setYear(newYear);
    setDateFrom(`${newYear}-01-01`);
    setDateTo(`${newYear}-12-31`);
  };

  const grandTotal = data ? (data.totals.personal.total + data.totals.business.total) : 0;
  const grandTax = data ? (data.totals.personal.tax + data.totals.business.tax) : 0;
  const grandCount = data ? (data.totals.personal.count + data.totals.business.count) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Tax Reports</Text>

        {/* Year Selector */}
        <View style={styles.yearRow}>
          <TouchableOpacity testID="year-prev-btn" onPress={() => changeYear(-1)} style={styles.yearBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{year}</Text>
          <TouchableOpacity testID="year-next-btn" onPress={() => changeYear(1)} style={styles.yearBtn}>
            <Ionicons name="chevron-forward" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Generate Button */}
        <TouchableOpacity testID="generate-report-btn" style={styles.generateBtn} onPress={fetchReport} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <Ionicons name="document-text" size={18} color={Colors.white} />
              <Text style={styles.generateText}>Generate Tax Summary</Text>
            </>
          )}
        </TouchableOpacity>

        {data && (
          <>
            {/* Grand Totals */}
            <View style={styles.grandCard}>
              <Text style={styles.grandTitle}>Tax Year {year} Summary</Text>
              <View style={styles.grandRow}>
                <View style={styles.grandItem}>
                  <Text style={styles.grandLabel}>Total Expenses</Text>
                  <Text style={styles.grandValue}>{fmt(grandTotal)}</Text>
                </View>
                <View style={styles.grandItem}>
                  <Text style={styles.grandLabel}>Total Tax (GST/HST)</Text>
                  <Text style={styles.grandValue}>{fmt(grandTax)}</Text>
                </View>
                <View style={styles.grandItem}>
                  <Text style={styles.grandLabel}>Receipts</Text>
                  <Text style={styles.grandValue}>{grandCount}</Text>
                </View>
              </View>
            </View>

            {/* Section Summaries */}
            {(['personal', 'business'] as const).map(sec => {
              const secData = data.summary[sec];
              const secTotals = data.totals[sec];
              if (!secData || secData.length === 0) return null;
              return (
                <View key={sec} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: sec === 'personal' ? Colors.primaryLight : Colors.business }]} />
                    <Text style={styles.sectionTitle}>{sec.charAt(0).toUpperCase() + sec.slice(1)}</Text>
                    <Text style={styles.sectionTotal}>{fmt(secTotals.total)}</Text>
                  </View>
                  {secData.map((cat: any, i: number) => (
                    <View key={i} style={styles.catRow}>
                      <Text style={styles.catName} numberOfLines={1}>{cat.category_name}</Text>
                      <Text style={styles.catCount}>{cat.count}</Text>
                      <Text style={styles.catTax}>{fmt(cat.tax)}</Text>
                      <Text style={styles.catTotal}>{fmt(cat.total)}</Text>
                    </View>
                  ))}
                  <View style={styles.catRowTotal}>
                    <Text style={styles.catTotalLabel}>Subtotal</Text>
                    <Text style={styles.catTotalTax}>{fmt(secTotals.tax)}</Text>
                    <Text style={styles.catTotalValue}>{fmt(secTotals.total)}</Text>
                  </View>
                </View>
              );
            })}

            {/* Export */}
            <TouchableOpacity testID="export-csv-btn" style={styles.exportBtn} onPress={exportCSV} disabled={exporting}>
              {exporting ? <ActivityIndicator color={Colors.secondary} /> : (
                <>
                  <Ionicons name="download-outline" size={18} color={Colors.secondary} />
                  <Text style={styles.exportText}>Export as CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.white, marginBottom: 20 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  yearBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  yearText: { fontSize: 24, fontWeight: '700', color: Colors.white },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, height: 48, borderRadius: 12, marginBottom: 20 },
  generateText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  grandCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 16 },
  grandTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 16 },
  grandRow: { flexDirection: 'row', gap: 12 },
  grandItem: { flex: 1, gap: 4 },
  grandLabel: { fontSize: 11, color: Colors.dark.textSecondary, fontWeight: '600' },
  grandValue: { fontSize: 18, fontWeight: '700', color: Colors.white },
  sectionCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.white },
  sectionTotal: { fontSize: 15, fontWeight: '700', color: Colors.white },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  catName: { flex: 1, fontSize: 13, color: Colors.dark.textSecondary },
  catCount: { fontSize: 12, color: Colors.dark.textTertiary, width: 30, textAlign: 'center' },
  catTax: { fontSize: 12, color: Colors.dark.textTertiary, width: 60, textAlign: 'right' },
  catTotal: { fontSize: 13, fontWeight: '600', color: Colors.white, width: 70, textAlign: 'right' },
  catRowTotal: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: Colors.dark.border },
  catTotalLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.white },
  catTotalTax: { fontSize: 12, color: Colors.dark.textTertiary, width: 60, textAlign: 'right' },
  catTotalValue: { fontSize: 13, fontWeight: '700', color: Colors.white, width: 70, textAlign: 'right' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.secondary, backgroundColor: 'rgba(26,201,255,0.08)', marginTop: 8 },
  exportText: { color: Colors.secondary, fontSize: 15, fontWeight: '600' },
});
