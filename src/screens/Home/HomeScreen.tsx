import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius, FontSize, Labels } from '../../constants';
import {
  getLedgers, getLedgerBalance, getDashboardChartData, getNetTrendData, TrendRange,
} from '../../repositories/ledgerRepository';
import { getLendingRequests } from '../../repositories/lendingRepository';
import { getItemTrackers } from '../../repositories/itemRepository';
import { formatAmount } from '../../data/currencies';
import { Ledger, LendingRequest } from '../../types';
import { RootTabParamList } from '../../navigation/BottomTabNavigator';
import { formatLendingOutstanding, getLendingMetrics } from '../../utils/lending';
import { SYSTEM_CATEGORIES } from '../../data/categories';
import AscendingNLogo from '../../components/AscendingNLogo';
import { getWorkspaceBaseCurrency } from '../../repositories/workspaceRepository';

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
  netBalance: number;
  incomeCategoryBreakdown: { categoryId: string; total: number }[];
  expenseCategoryBreakdown: { categoryId: string; total: number }[];
}

type TrendPoint = {
  label: string;
  netAmount: number;
};

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

function CategoryBars({ breakdown, maxAmount, currency }: { breakdown: { categoryId: string; total: number }[]; maxAmount: number; currency: string }) {
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
              <Text style={chartStyles.barName} numberOfLines={1}>{cat?.name ?? categoryId}</Text>
            </View>
            <View style={chartStyles.barTrack}>
              <View style={[chartStyles.barFill, { width: `${pct}%`, backgroundColor: cat?.color ?? Colors.primary }]} />
            </View>
            <Text style={chartStyles.barAmount}>{formatAmount(total, currency)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function NetTrendLine({ points, currency }: { points: TrendPoint[]; currency: string }) {
  if (points.length === 0) {
    return <Text style={chartStyles.emptyText}>No trend data yet</Text>;
  }

  const values = points.map((point) => point.netAmount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartHeight = 120;
  const chartWidth = 320;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: Math.max(chartWidth, points.length * 38), height: chartHeight + 40 }}>
        {points.map((point, index) => {
          const x = points.length === 1 ? 0 : (index / (points.length - 1)) * (Math.max(chartWidth, points.length * 38) - 20);
          const y = chartHeight - ((point.netAmount - min) / range) * chartHeight;
          const previous = index > 0 ? points[index - 1] : null;
          const prevX = index > 0 ? ((index - 1) / (points.length - 1)) * (Math.max(chartWidth, points.length * 38) - 20) : 0;
          const prevY = previous ? chartHeight - ((previous.netAmount - min) / range) * chartHeight : 0;
          const dx = x - prevX;
          const dy = y - prevY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View key={`${point.label}_${index}`}>
              {previous && (
                <View
                  style={[
                    chartStyles.lineSegment,
                    {
                      width: distance,
                      left: ((prevX + x) / 2) + 10 - (distance / 2),
                      top: ((prevY + y) / 2) + 10 - 1,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              )}
              <View style={[chartStyles.point, { left: x + 6, top: y + 6 }]} />
              <Text style={[chartStyles.pointLabel, { left: x, top: chartHeight + 16 }]} numberOfLines={1}>
                {point.label}
              </Text>
            </View>
          );
        })}
        <Text style={chartStyles.trendMin}>{formatAmount(min, currency)}</Text>
        <Text style={chartStyles.trendMax}>{formatAmount(max, currency)}</Text>
      </View>
    </ScrollView>
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
  const [chartData, setChartData] = useState<ChartData>({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    incomeCategoryBreakdown: [],
    expenseCategoryBreakdown: [],
  });
  const [baseCurrency, setBaseCurrency] = useState('PHP');
  const [trendRange, setTrendRange] = useState<TrendRange>('monthly');
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const currentBaseCurrency = await getWorkspaceBaseCurrency();
      setBaseCurrency(currentBaseCurrency);
      const [ls, lrs, trackers, chart, trend] = await Promise.all([
        getLedgers(),
        getLendingRequests(),
        getItemTrackers(),
        getDashboardChartData(currentBaseCurrency),
        getNetTrendData(currentBaseCurrency, trendRange),
      ]);

      setLedgers(ls);
      setLendingRequests(lrs);
      setTrackerCount(trackers.length);
      setTrackedItemCount(trackers.reduce((count, tracker) => count + tracker.items.length, 0));
      setChartData(chart);
      setTrendPoints(trend);

      const balances = await Promise.all(
        ls.map(async (ledger) => [ledger.id, await getLedgerBalance(ledger.id, ledger.baseCurrency)] as const)
      );
      const nextLedgerBalances = Object.fromEntries(balances);
      setLedgerBalances(nextLedgerBalances);
      setTotalBalance(Object.values(nextLedgerBalances).reduce((sum, balance) => sum + balance, 0));
    } catch (_) {}
  }, [trendRange]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const lendingMetrics = useMemo(() => getLendingMetrics(lendingRequests), [lendingRequests]);
  const outstandingLabel = useMemo(() => formatLendingOutstanding(lendingRequests), [lendingRequests]);
  const maxIncomeCategoryAmount = chartData.incomeCategoryBreakdown.length > 0 ? chartData.incomeCategoryBreakdown[0].total : 0;
  const maxExpenseCategoryAmount = chartData.expenseCategoryBreakdown.length > 0 ? chartData.expenseCategoryBreakdown[0].total : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.brandWatermark}>
          <AscendingNLogo size={60} subtle />
        </View>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <AscendingNLogo size={26} />
          </View>
          <View>
            <Text style={styles.appName}>{Labels.appName}</Text>
            <Text style={styles.subtitle}>Dashboard</Text>
          </View>
        </View>
        <Text style={styles.headerNote}>Track what is truly saved, spent, and owed with a net-first view.</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.primaryCard]}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          <Text style={styles.balanceAmount}>{formatAmount(totalBalance, baseCurrency)}</Text>
          <Text style={styles.ledgerCount}>{ledgers.length} Cash Ledger{ledgers.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Tracked Items</Text>
          <Text style={styles.statValue}>{trackedItemCount}</Text>
          <Text style={styles.statHint}>{trackerCount} inventory list{trackerCount !== 1 ? 's' : ''} active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending Settlements</Text>
          <Text style={styles.statValue}>{lendingMetrics.pendingCount}</Text>
          <Text style={styles.statHint}>{lendingMetrics.approvedCount} active request{lendingMetrics.approvedCount !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Outstanding Net Owed</Text>
          <Text style={styles.statValueSmall}>{outstandingLabel}</Text>
          <Text style={styles.statHint}>{lendingMetrics.settledCount} settled request{lendingMetrics.settledCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Net Result</Text>
      <View style={styles.chartCard}>
        <View style={styles.chartAmounts}>
          <View>
            <Text style={styles.chartAmountLabel}>Calculated Net</Text>
            <Text
              style={[
                styles.chartAmount,
                { color: chartData.netBalance >= 0 ? Colors.cashIn : Colors.cashOut },
              ]}
            >
              {formatAmount(chartData.netBalance, baseCurrency)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Income vs Expenses</Text>
      <View style={styles.chartCard}>
        <View style={styles.chartAmounts}>
          <View>
            <Text style={styles.chartAmountLabel}>Total Income</Text>
            <Text style={[styles.chartAmount, { color: Colors.cashIn }]}>{formatAmount(chartData.totalIncome, baseCurrency)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.chartAmountLabel}>Total Expenses</Text>
            <Text style={[styles.chartAmount, { color: Colors.cashOut }]}>{formatAmount(chartData.totalExpenses, baseCurrency)}</Text>
          </View>
        </View>
        <IncomeExpenseBar income={chartData.totalIncome} expenses={chartData.totalExpenses} />
      </View>

      <Text style={styles.sectionTitle}>Savings Overview</Text>
      <View style={styles.chartCard}>
        <SavingsBar income={chartData.totalIncome} expenses={chartData.totalExpenses} currency={baseCurrency} />
      </View>

      <Text style={styles.sectionTitle}>Net Cash Trend</Text>
      <View style={styles.chartCard}>
        <View style={styles.rangeRow}>
          {(['daily', 'weekly', 'monthly', 'annual'] as TrendRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.rangeChip, trendRange === range && styles.rangeChipActive]}
              onPress={() => setTrendRange(range)}
            >
              <Text style={[styles.rangeChipText, trendRange === range && styles.rangeChipTextActive]}>{range}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <NetTrendLine points={trendPoints} currency={baseCurrency} />
      </View>

      <Text style={styles.sectionTitle}>Top Savings Categories</Text>
      <View style={styles.chartCard}>
        <CategoryBars breakdown={chartData.incomeCategoryBreakdown} maxAmount={maxIncomeCategoryAmount} currency={baseCurrency} />
      </View>

      <Text style={styles.sectionTitle}>Top Spending Categories</Text>
      <View style={styles.chartCard}>
        <CategoryBars breakdown={chartData.expenseCategoryBreakdown} maxAmount={maxExpenseCategoryAmount} currency={baseCurrency} />
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {[
          { label: 'Cash Ledgers', route: 'Ledgers' as const },
          { label: 'Itemized Inventories', route: 'Itemized' as const },
          { label: 'Settlement Hub', route: 'Lending' as const },
          { label: 'Settings', route: 'Settings' as const },
        ].map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.quickAction}
            activeOpacity={0.86}
            onPress={() => navigation.navigate(a.route)}
          >
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Ledgers</Text>
      {ledgers.length === 0 ? (
        <Text style={styles.empty}>No ledgers yet. Go to Cash Ledgers to add one.</Text>
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

      <Text style={styles.sectionTitle}>Settlement Snapshot</Text>
      {lendingRequests.length === 0 ? (
        <Text style={styles.empty}>No lending requests yet.</Text>
      ) : (
        lendingRequests.slice(0, 4).map((request) => (
          <TouchableOpacity key={request.id} style={styles.lendingCard} activeOpacity={0.86} onPress={() => navigation.navigate('Lending')}>
            <View style={styles.lendingTop}>
              <Text style={styles.lendingName}>{request.borrowerName}</Text>
              <Text style={[styles.lendingStatus, STATUS_STYLE[request.status]]}>
                {STATUS_LABEL[request.status]}
              </Text>
            </View>
            <Text style={styles.lendingAmount}>{formatAmount(request.amount, request.currency)}</Text>
            <Text style={styles.lendingMeta}>{request.createdAt.split('T')[0]}</Text>
          </TouchableOpacity>
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
  barLabel: { flexDirection: 'row', alignItems: 'center', width: 120 },
  barName: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  barTrack: { flex: 1, height: 10, backgroundColor: Colors.surfaceAlt, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, minWidth: 4 },
  barAmount: { fontSize: FontSize.xs, color: Colors.textMuted, width: 72, textAlign: 'right' },
  lineSegment: { position: 'absolute', height: 2, backgroundColor: Colors.primary },
  point: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  pointLabel: { position: 'absolute', width: 44, fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  trendMin: { position: 'absolute', left: 0, bottom: 30, fontSize: 10, color: Colors.textMuted },
  trendMax: { position: 'absolute', left: 0, top: 0, fontSize: 10, color: Colors.textMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { marginBottom: Spacing.lg, position: 'relative' },
  brandWatermark: { position: 'absolute', right: 0, top: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  rangeRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  rangeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  rangeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rangeChipText: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize', fontWeight: '600' },
  rangeChipTextActive: { color: '#fff' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  quickAction: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', flex: 1, minWidth: '40%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  quickLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600' },
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
