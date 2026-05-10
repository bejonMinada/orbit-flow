import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize, Labels } from '../../constants';
import { getLedgers, getLedgerBalance } from '../../repositories/ledgerRepository';
import { getLendingRequests } from '../../repositories/lendingRepository';
import { formatAmount } from '../../data/currencies';
import { Ledger, LendingRequest } from '../../types';

export default function HomeScreen() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const ls = await getLedgers();
      setLedgers(ls);
      let total = 0;
      for (const l of ls) {
        const bal = await getLedgerBalance(l.id, l.baseCurrency);
        total += bal;
      }
      setTotalBalance(total);
      const lrs: LendingRequest[] = await getLendingRequests();
      setPendingCount(lrs.filter((r) => r.status === 'pending_admin_approval').length);
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.appName}>{Labels.appName}</Text>
        <Text style={styles.subtitle}>Your financial orbit</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatAmount(totalBalance, 'PHP')}</Text>
        <Text style={styles.ledgerCount}>{ledgers.length} Cash Ledger{ledgers.length !== 1 ? 's' : ''}</Text>
      </View>

      {pendingCount > 0 && (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>🔔 {pendingCount} pending lending request{pendingCount > 1 ? 's' : ''} awaiting approval</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {[
          { emoji: '💳', label: 'Cash Ledgers' },
          { emoji: '📦', label: 'Itemized' },
          { emoji: '🤝', label: 'Lending' },
          { emoji: '⚙️', label: 'Settings' },
        ].map((a) => (
          <View key={a.label} style={styles.quickAction}>
            <Text style={styles.quickEmoji}>{a.emoji}</Text>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Ledgers</Text>
      {ledgers.length === 0 ? (
        <Text style={styles.empty}>No ledgers yet. Go to Cash Ledgers tab to add one.</Text>
      ) : (
        ledgers.slice(0, 3).map((l) => (
          <View key={l.id} style={styles.ledgerCard}>
            <Text style={styles.ledgerName}>{l.name}</Text>
            <Text style={styles.ledgerCurrency}>{l.baseCurrency}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { marginBottom: Spacing.lg },
  appName: { fontSize: FontSize.xxxl, fontWeight: 'bold', color: Colors.primary },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 2 },
  balanceCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
  balanceAmount: { color: '#fff', fontSize: FontSize.xxxl, fontWeight: 'bold', marginTop: 4 },
  ledgerCount: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm, marginTop: 4 },
  alertCard: {
    backgroundColor: '#FFF3CD', borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderLeftWidth: 4, borderLeftColor: Colors.warning,
  },
  alertText: { color: '#856404', fontSize: FontSize.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  quickAction: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', flex: 1, minWidth: '40%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  quickEmoji: { fontSize: 28, marginBottom: 4 },
  quickLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  ledgerCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  ledgerName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  ledgerCurrency: { fontSize: FontSize.sm, color: Colors.textSecondary },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic' },
});
