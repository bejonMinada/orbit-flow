import React, { useState, useCallback, useMemo, useRef } from 'react';
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
import { useThemeMode } from '../../theme/ThemeContext';

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
  const scrollRef = useRef<ScrollView | null>(null);
  if (points.length === 0) {
    return <Text style={chartStyles.emptyText}>No trend data yet</Text>;
  }

  const values = points.map((point) => point.netAmount);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = maxValue - minValue || 1;
  const chartHeight = 140;
  const chartWidth = 320;
  const graphWidth = Math.max(chartWidth, points.length * 44);
  const zeroY = ((maxValue - 0) / range) * chartHeight;

  return (
    <View style={chartStyles.trendRow}>
      <View style={chartStyles.fixedYAxis}>
        <Text style={chartStyles.trendMaxFixed}>{formatAmount(maxValue, currency)}</Text>
        <Text style={chartStyles.trendZeroFixed}>{formatAmount(0, currency)}</Text>
        <Text style={chartStyles.trendMinFixed}>{formatAmount(minValue, currency)}</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={{ width: graphWidth, height: chartHeight + 40 }}>
          <View style={[chartStyles.zeroLine, { top: zeroY }]} />
          {points.map((point, index) => {
            const barXPosition = points.length === 1 ? 0 : (index / (points.length - 1)) * (graphWidth - 24);
            const barYPosition = ((maxValue - point.netAmount) / range) * chartHeight;
            const barHeight = Math.max(2, Math.abs(zeroY - barYPosition));
            const barTop = point.netAmount >= 0 ? barYPosition : zeroY;
            return (
              <View key={`${point.label}_${index}`}>
                <View
                  style={[
                    chartStyles.trendBar,
                    {
                      left: barXPosition + 6,
                      top: barTop,
                      height: barHeight,
                      backgroundColor: point.netAmount >= 0 ? Colors.cashIn : Colors.cashOut,
                    },
                  ]}
                />
                <Text style={[chartStyles.pointLabel, { left: barXPosition - 2, top: chartHeight + 16 }]} numberOfLines={1}>
                  {point.label}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const insets = useSafeAreaInsets();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const darkSurface = '#1F252F';
  const darkText = '#E6E9EE';
  const darkMuted = '#B8C2D1';
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerBalances, setLedgerBalances] = useState<Record<string, number>>({});
  const [lendingRequests, setLendingRequests] = useState<LendingRequest[]>([]);
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
    } catch (_) {}
  }, [trendRange]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const lendingMetrics = useMemo(() => getLendingMetrics(lendingRequests), [lendingRequests]);
  const outstandingLabel = useMemo(() => formatLendingOutstanding(lendingRequests), [lendingRequests]);
  const maxIncomeCategoryAmount = chartData.incomeCategoryBreakdown.length > 0 ? chartData.incomeCategoryBreakdown[0].total : 0;
  const maxExpenseCategoryAmount = chartData.expenseCategoryBreakdown.length > 0 ? chartData.expenseCategoryBreakdown[0].total : 0;
  const netCardColor = chartData.netBalance < 0 ? Colors.danger : (chartData.netBalance === 0 ? Colors.settled : Colors.primary);

  return (
    <ScrollView
      style={[styles.container, isDark && { backgroundColor: '#12161D' }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#E6E9EE' : Colors.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <AscendingNLogo size={26} />
          </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.appName}>{Labels.appName}</Text>
              <Text style={[styles.appDefinition, isDark && { color: darkMuted }]}>Track net cash, inventory, and settlements.</Text>
            </View>
          </View>
        <Text style={[styles.subtitle, isDark && { color: darkMuted }]}>Dashboard</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.primaryCard, { backgroundColor: netCardColor }]}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          <Text style={styles.balanceAmount}>{formatAmount(chartData.netBalance, baseCurrency)}</Text>
          <Text style={styles.ledgerCount}>Net Result (Income - Expenses)</Text>
        </View>
        <View style={styles.statsRowThree}>
          <View style={[styles.statCard, styles.statCardCompact, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.statLabelCompact, isDark && { color: darkMuted }]} numberOfLines={1}>Tracked</Text>
            <Text style={[styles.statValue, isDark && { color: darkText }]}>{trackedItemCount}</Text>
            <Text style={[styles.statHintCompact, isDark && { color: darkMuted }]} numberOfLines={1}>{trackerCount} active</Text>
          </View>
          <View style={[styles.statCard, styles.statCardCompact, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.statLabelCompact, isDark && { color: darkMuted }]} numberOfLines={1}>Pending</Text>
            <Text style={[styles.statValue, isDark && { color: darkText }]}>{lendingMetrics.pendingCount}</Text>
            <Text style={[styles.statHintCompact, isDark && { color: darkMuted }]} numberOfLines={1}>{lendingMetrics.approvedCount} active</Text>
          </View>
          <View style={[styles.statCard, styles.statCardCompact, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.statLabelCompact, isDark && { color: darkMuted }]} numberOfLines={1}>Lent Amount</Text>
            <Text style={[styles.statValueSmall, isDark && { color: darkText }]} numberOfLines={1}>{outstandingLabel}</Text>
            <Text style={[styles.statHintCompact, isDark && { color: darkMuted }]} numberOfLines={1}>{lendingMetrics.settledCount} settled</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Income vs Expenses</Text>
      <View style={[styles.chartCard, isDark && { backgroundColor: darkSurface }]}>
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

      <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Net Cash Trend</Text>
      <View style={[styles.chartCard, isDark && { backgroundColor: darkSurface }]}>
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

      <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Top Savings Categories</Text>
      <View style={[styles.chartCard, isDark && { backgroundColor: darkSurface }]}>
        <CategoryBars breakdown={chartData.incomeCategoryBreakdown} maxAmount={maxIncomeCategoryAmount} currency={baseCurrency} />
      </View>

      <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Top Spending Categories</Text>
      <View style={[styles.chartCard, isDark && { backgroundColor: darkSurface }]}>
        <CategoryBars breakdown={chartData.expenseCategoryBreakdown} maxAmount={maxExpenseCategoryAmount} currency={baseCurrency} />
      </View>

      <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Recent Ledgers</Text>
      {ledgers.length === 0 ? (
        <Text style={[styles.empty, isDark && { color: darkMuted }]}>No ledgers yet. Go to Cash Ledgers to add one.</Text>
      ) : (
        ledgers.slice(0, 3).map((l) => (
          <View key={l.id} style={[styles.ledgerCard, isDark && { backgroundColor: darkSurface }]}>
            <View>
              <Text style={[styles.ledgerName, isDark && { color: darkText }]}>{l.name}</Text>
              <Text style={[styles.ledgerCurrency, isDark && { color: darkMuted }]}>{l.baseCurrency}</Text>
            </View>
            <Text style={[styles.ledgerBalance, { color: (ledgerBalances[l.id] ?? 0) >= 0 ? Colors.cashIn : Colors.cashOut }]}>
              {formatAmount(ledgerBalances[l.id] ?? 0, l.baseCurrency)}
            </Text>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Settlement Snapshot</Text>
      {lendingRequests.length === 0 ? (
        <Text style={[styles.empty, isDark && { color: darkMuted }]}>No lending requests yet.</Text>
      ) : (
        lendingRequests.slice(0, 4).map((request) => (
          <TouchableOpacity key={request.id} style={[styles.lendingCard, isDark && { backgroundColor: darkSurface }]} activeOpacity={0.86} onPress={() => navigation.navigate('Lending')}>
            <View style={styles.lendingTop}>
              <Text style={[styles.lendingName, isDark && { color: darkText }]}>{request.borrowerName}</Text>
              <Text style={[styles.lendingStatus, STATUS_STYLE[request.status]]}>
                {STATUS_LABEL[request.status]}
              </Text>
            </View>
            <Text style={[styles.lendingAmount, isDark && { color: darkText }]}>{formatAmount(request.amount, request.currency)}</Text>
            <Text style={[styles.lendingMeta, isDark && { color: darkMuted }]}>{request.createdAt.split('T')[0]}</Text>
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
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.xs },
  barLabel: { flexDirection: 'row', alignItems: 'center', width: 120 },
  barName: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  barTrack: { flex: 1, height: 10, backgroundColor: Colors.surfaceAlt, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, minWidth: 4 },
  barAmount: { fontSize: FontSize.xs, color: Colors.textMuted, width: 72, textAlign: 'right' },
  trendBar: { position: 'absolute', width: 16, borderRadius: Radius.sm },
  zeroLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.textMuted, opacity: 0.5 },
  pointLabel: { position: 'absolute', width: 44, fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  trendRow: { flexDirection: 'row', alignItems: 'stretch' },
  fixedYAxis: { width: 78, justifyContent: 'space-between', paddingVertical: 2, paddingRight: Spacing.xs },
  trendMinFixed: { fontSize: 10, color: Colors.textMuted },
  trendZeroFixed: { fontSize: 10, color: Colors.textMuted, alignSelf: 'flex-start' },
  trendMaxFixed: { fontSize: 10, color: Colors.textMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { marginBottom: Spacing.lg, position: 'relative' },
  brandRow: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
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
  brandTextWrap: { height: 52, justifyContent: 'space-between' },
  appName: { fontSize: FontSize.xxxl, fontWeight: 'bold', color: Colors.primary },
  appDefinition: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 17, maxWidth: 250 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.lg, fontWeight: '600' },
  statsGrid: { gap: Spacing.sm, marginBottom: Spacing.md },
  statsRowThree: { flexDirection: 'row', gap: Spacing.sm },
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
  statLabelCompact: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  statValue: { color: Colors.textPrimary, fontSize: FontSize.xxl, fontWeight: '700', marginTop: 4 },
  statValueSmall: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700', marginTop: 6 },
  statHint: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 4 },
  statHintCompact: { color: Colors.textMuted, fontSize: 10, marginTop: 4 },
  statCardCompact: { flex: 1, padding: Spacing.sm },
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
