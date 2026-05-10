import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius, FontSize, Labels } from '../../constants';
import { getLedgers, getLedgerBalance, getDashboardChartData } from '../../repositories/ledgerRepository';
import { getLendingRequests } from '../../repositories/lendingRepository';
import { getItemTrackers } from '../../repositories/itemRepository';
import { formatAmount } from '../../data/currencies';
import { Ledger, LendingRequest } from '../../types';
import { RootTabParamList } from '../../navigation/BottomTabNavigator';
import { formatLendingOutstanding, getLendingMetrics } from '../../utils/lending';
import { SYSTEM_CATEGORIES } from '../../data/categories';

const STATUS_LABEL: Record<LendingRequest['status'], string> = {
  pending_admin_approval: 'Pending Admin Approval',
  approved: 'Approved',
  declined: 'Declined',
  settled: 'Settled',
};

const STATUS_STYLE: Record<LendingRequest['status'], { color: string }> = {
  pending_admin_approval: { color: Colors.warning },
  approved: { color: Colors.approved },
  declined: { color: Colors.declined },
  settled: { color: Colors.settled },
};

interface ChartData {
  totalIncome: number;
  totalExpenses: number;
  categoryBreakdown: { categoryId: string; total: number }[];
}

function IncomeExpenseBar({ income, expenses }: { income: number; expenses: number }) {
  const total = income + expenses;
  if (total === 0) {
    return (
      <View style={chartStyles.emptyBar}>
        <Text style={chartStyles.emptyText}>No transactions yet</Text>
      </View>
    );
  }
  const incomePct = (income / total) * 100;
  const expensePct = (expenses / total) * 100;
  return (
    <View>
      <View style={chartStyles.segmentedBar}>
        {income > 0 && (
          <View style={[chartStyles.segment, { width: `${incomePct}%`, backgroundColor: Colors.cashIn }]} />
        )}
        {expenses > 0 && (
          <View style={[chartStyles.segment, { width: `${expensePct}%`, backgroundColor: Colors.cashOut }]} />
        )}
      </View>
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: Colors.cashIn }]} />
          <Text style={chartStyles.legendText}>Income ({incomePct.toFixed(0)}%)</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: Colors.cashOut }]} />
          <Text style={chartStyles.legendText}>Expenses ({expensePct.toFixed(0)}%)</Text>
        </View>
      </View>
    </View>
  );
}

function SavingsBar({ income, expenses, currency }: { income: number; expenses: number; currency: string }) {
  const savings = income - expenses;
  const savingsPct = income > 0 ? Math.max(0, Math.min(100, (savings / income) * 100)) : 0;
  const color = savingsPct >= 20 ? Colors.cashIn : savingsPct >= 5 ? Colors.warning : Colors.cashOut;
  return (
    <View>
      <View style={chartStyles.savingsRow}>
        <Text style={chartStyles.savingsLabel}>Savings Rate</Text>
        <Text style={[chartStyles.savingsPct, { color }]}>{savingsPct.toFixed(1)}%</Text>
      </View>
      <View style={chartStyles.progressTrack}>
        <View style={[chartStyles.progressFill, { width: `${savingsPct}%`, backgroundColor: color }]} />
      </View>
      <Text style={chartStyles.savingsHint}>
        {savings >= 0 ? `Saving ${formatAmount(savings, currency)} of income` : `Overspent by ${formatAmount(Math.abs(savings), currency)}`}
      </Text>
    </View>
  );
}

function CategoryBars({ breakdown, maxAmount }: { breakdown: { categoryId: string; total: number }[]; maxAmount: number }) {
  if (breakdown.length === 0) {
    return <Text style={chartStyles.emptyText}>No expense data yet</Text>;
  }
  return (
    <View>
      {breakdown.map(({ categoryId, total }) => {
        const cat = SYSTEM_CATEGORIES.find((c) => c.id === categoryId);
        const pct = maxAmount > 0 ? (total / maxAmount) * 100 : 0;
        return (
          <View key={categoryId} style={chartStyles.barRow}>
            <View style={chartStyles.barLabel}>
              <Text style={chartStyles.barIcon}>{cat?.icon ?? '📌'}</Text>
              <Text style={chartStyles.barName} numberOfLines={1}>{cat?.name ?? categoryId}</Text>
            </View>
            <View style={chartStyles.barTrack}>
              <View style={[chartStyles.barFill, { width: `${pct}%`, backgroundColor: cat?.color ?? Colors.primary }]} />
            </View>
            <Text style={chartStyles.barAmount}>{formatAmount(total, 'PHP')}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const insets = useSafeAreaInsets();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerBalances, setLedgerBalances] = useState<Record<string, number>>({});
  const [lendingRequests, setLendingRequests] = useState<LendingRequest[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [trackerCount, setTrackerCount] = useState(0);
  const [trackedItemCount, setTrackedItemCount] = useState(0);
  const [chartData, setChartData] = useState<ChartData>({ totalIncome: 0, totalExpenses: 0, categoryBreakdown: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ls, lrs, trackers, chart] = await Promise.all([
        getLedgers(),
        getLendingRequests(),
        getItemTrackers(),
        getDashboardChartData('PHP'),
      ]);

      setLedgers(ls);
      setLendingRequests(lrs);
      setTrackerCount(trackers.length);
      setTrackedItemCount(trackers.reduce((count, tracker) => count + tracker.items.length, 0));
      setChartData(chart);

      const balances = await Promise.all(
        ls.map(async (ledger) => [ledger.id, await getLedgerBalance(ledger.id, ledger.baseCurrency)] as const)
      );
      const nextLedgerBalances = Object.fromEntries(balances);
      setLedgerBalances(nextLedgerBalances);
      setTotalBalance(Object.values(nextLedgerBalances).reduce((sum, balance) => sum + balance, 0));
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const lendingMetrics = useMemo(() => getLendingMetrics(lendingRequests), [lendingRequests]);
  const outstandingLabel = useMemo(() => formatLendingOutstanding(lendingRequests), [lendingRequests]);
  const maxCategoryAmount = chartData.categoryBreakdown.length > 0 ? chartData.categoryBreakdown[0].total : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoEmoji}>📊</Text>
          </View>
          <View>
            <Text style={styles.appName}>{Labels.appName}</Text>
            <Text style={styles.subtitle}>Dashboard</Text>
          </View>
        </View>
        <Text style={styles.headerNote}>See your balances, inventory, and lending activity in one place.</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.primaryCard]}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>{formatAmount(totalBalance, 'PHP')}</Text>
          <Text style={styles.ledgerCount}>{ledgers.length} Cash Ledger{ledgers.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Tracked Items</Text>
          <Text style={styles.statValue}>{trackedItemCount}</Text>
          <Text style={styles.statHint}>{trackerCount} tracker{trackerCount !== 1 ? 's' : ''} active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending Lending</Text>
          <Text style={styles.statValue}>{lendingMetrics.pendingCount}</Text>
          <Text style={styles.statHint}>{lendingMetrics.approvedCount} active loan{lendingMetrics.approvedCount !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Outstanding Lending</Text>
          <Text style={styles.statValueSmall}>{outstandingLabel}</Text>
          <Text style={styles.statHint}>{lendingMetrics.settledCount} settled request{lendingMetrics.settledCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Income vs Expenses</Text>
      <View style={styles.chartCard}>
        <View style={styles.chartAmounts}>
          <View>
            <Text style={styles.chartAmountLabel}>Total Income</Text>
            <Text style={[styles.chartAmount, { color: Colors.cashIn }]}>{formatAmount(chartData.totalIncome, 'PHP')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.chartAmountLabel}>Total Expenses</Text>
            <Text style={[styles.chartAmount, { color: Colors.cashOut }]}>{formatAmount(chartData.totalExpenses, 'PHP')}</Text>
          </View>
        </View>
        <IncomeExpenseBar income={chartData.totalIncome} expenses={chartData.totalExpenses} />
      </View>

      <Text style={styles.sectionTitle}>Savings Overview</Text>
      <View style={styles.chartCard}>
        <SavingsBar income={chartData.totalIncome} expenses={chartData.totalExpenses} currency="PHP" />
      </View>

      <Text style={styles.sectionTitle}>Top Expense Categories</Text>
      <View style={styles.chartCard}>
        <CategoryBars breakdown={chartData.categoryBreakdown} maxAmount={maxCategoryAmount} />
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {[
          { emoji: '💰', label: 'Cash Ledgers', route: 'Ledgers' as const },
          { emoji: '🧾', label: 'Itemized', route: 'Itemized' as const },
          { emoji: '💵', label: 'Lending', route: 'Lending' as const },
          { emoji: '⚙️', label: 'Settings', route: 'Settings' as const },
        ].map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.quickAction}
            activeOpacity={0.86}
            onPress={() => navigation.navigate(a.route)}
          >
            <Text style={styles.quickEmoji}>{a.emoji}</Text>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Ledgers</Text>
      {ledgers.length === 0 ? (
        <Text style={styles.empty}>No ledgers yet. Go to Cash Ledgers tab to add one.</Text>
      ) : (
        ledgers.slice(0, 3).map((l) => (
          <View key={l.id} style={styles.ledgerCard}>
            <View>
              <Text style={styles.ledgerName}>{l.name}</Text>
              <Text style={styles.ledgerCurrency}>{l.baseCurrency}</Text>
            </View>
            <Text style={[styles.ledgerBalance, { color: (ledgerBalances[l.id] ?? 0) >= 0 ? Colors.cashIn : Colors.cashOut }]}>
              {formatAmount(ledgerBalances[l.id] ?? 0, l.baseCurrency)}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Lending Snapshot</Text>
      {lendingRequests.length === 0 ? (
        <Text style={styles.empty}>No lending requests yet.</Text>
      ) : (
        lendingRequests.slice(0, 4).map((request) => (
          <View key={request.id} style={styles.lendingCard}>
            <View style={styles.lendingTop}>
              <Text style={styles.lendingName}>{request.borrowerName}</Text>
              <Text style={[styles.lendingStatus, STATUS_STYLE[request.status]]}>
                {STATUS_LABEL[request.status]}
              </Text>
            </View>
            <Text style={styles.lendingAmount}>{formatAmount(request.amount, request.currency)}</Text>
            <Text style={styles.lendingMeta}>{request.createdAt.split('T')[0]}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const chartStyles = StyleSheet.create({
  segmentedBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceAlt },
  segment: { height: 16 },
  legend: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  emptyBar: { height: 16, backgroundColor: Colors.surfaceAlt, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  savingsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  savingsLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  savingsPct: { fontSize: FontSize.sm, fontWeight: 'bold' },
  progressTrack: { height: 12, backgroundColor: Colors.surfaceAlt, borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: 12, borderRadius: 6 },
  savingsHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.xs },
  barLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 120 },
  barIcon: { fontSize: 14 },
  barName: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  barTrack: { flex: 1, height: 10, backgroundColor: Colors.surfaceAlt, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, minWidth: 4 },
  barAmount: { fontSize: FontSize.xs, color: Colors.textMuted, width: 72, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { marginBottom: Spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 26 },
  appName: { fontSize: FontSize.xxxl, fontWeight: 'bold', color: Colors.primary },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },
  headerNote: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  statsGrid: { gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
  balanceAmount: { color: '#fff', fontSize: FontSize.xxxl, fontWeight: 'bold', marginTop: 4 },
  ledgerCount: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm, marginTop: 4 },
  statLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  statValue: { color: Colors.textPrimary, fontSize: FontSize.xxl, fontWeight: '700', marginTop: 4 },
  statValueSmall: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700', marginTop: 6 },
  statHint: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 4 },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  chartAmountLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chartAmount: { fontSize: FontSize.lg, fontWeight: 'bold', marginTop: 2 },
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
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  ledgerName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  ledgerCurrency: { fontSize: FontSize.sm, color: Colors.textSecondary },
  ledgerBalance: { fontSize: FontSize.md, fontWeight: '700' },
  lendingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lendingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  lendingName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600', flex: 1 },
  lendingStatus: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'capitalize' },
  lendingAmount: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700', marginTop: 6 },
  lendingMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic' },
});
