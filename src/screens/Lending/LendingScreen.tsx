import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, FontSize, Labels } from '../../constants';
import { getLendingRequests, createLendingRequest, updateLendingStatus } from '../../repositories/lendingRepository';
import { getLedgers, getLedgerBalance } from '../../repositories/ledgerRepository';
import { LendingRequest, Ledger, LendingStatus } from '../../types';
import { formatAmount } from '../../data/currencies';
import { formatLendingOutstanding, getLendingMetrics } from '../../utils/lending';

const STATUS_COLOR: Record<LendingStatus, string> = {
  pending_admin_approval: Colors.warning,
  approved: Colors.approved,
  declined: Colors.declined,
  settled: Colors.settled,
};

const STATUS_LABEL: Record<LendingStatus, string> = {
  pending_admin_approval: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  settled: 'Settled',
};

function getOverdueInfo(req: LendingRequest): { daysOverdue: number; penaltyAmount: number } {
  if (!req.dueDate || req.penaltyRate <= 0 || req.status !== 'approved') {
    return { daysOverdue: 0, penaltyAmount: 0 };
  }
  const due = new Date(req.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
  const penaltyAmount = req.amount * (req.penaltyRate / 100) * daysOverdue;
  return { daysOverdue, penaltyAmount };
}

export default function LendingScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<LendingRequest[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerBalances, setLedgerBalances] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [pendingSettleId, setPendingSettleId] = useState<string>('');
  const [settleRefNum, setSettleRefNum] = useState('');

  const [borrowerName, setBorrowerName] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [penaltyRate, setPenaltyRate] = useState('');
  const [note, setNote] = useState('');
  const [selectedLedgerId, setSelectedLedgerId] = useState('');

  const load = useCallback(async () => {
    const [rs, ls] = await Promise.all([getLendingRequests(), getLedgers()]);
    setRequests(rs);
    setLedgers(ls);
    const balances = await Promise.all(
      ls.map(async (ledger) => [ledger.id, await getLedgerBalance(ledger.id, ledger.baseCurrency)] as const)
    );
    setLedgerBalances(Object.fromEntries(balances));
    if (ls.length > 0 && !selectedLedgerId) setSelectedLedgerId(ls[0].id);
  }, [selectedLedgerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const lendingMetrics = getLendingMetrics(requests);
  const outstandingLabel = formatLendingOutstanding(requests);

  const resetForm = () => {
    setBorrowerName(''); setAmount(''); setInterestRate('');
    setDueDate(''); setPenaltyRate(''); setNote('');
  };

  const handleAdd = async () => {
    if (!borrowerName.trim() || !amount.trim() || !selectedLedgerId) {
      Alert.alert('Missing fields', 'Please fill in borrower name, amount and select a ledger.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    const parsedInterest = parseFloat(interestRate) || 0;
    const parsedPenalty = parseFloat(penaltyRate) || 0;
    const trimmedDueDate = dueDate.trim() || undefined;

    if (trimmedDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDueDate)) {
      Alert.alert('Invalid date', 'Please enter the due date in YYYY-MM-DD format.');
      return;
    }

    try {
      const ledger = ledgers.find((l) => l.id === selectedLedgerId);
      await createLendingRequest(
        selectedLedgerId, borrowerName.trim(), parsedAmount,
        ledger?.baseCurrency ?? 'PHP', parsedInterest, trimmedDueDate,
        parsedPenalty, undefined, note.trim() || undefined
      );
      resetForm();
      setModalVisible(false);
      load();
    } catch (error) {
      Alert.alert('Unable to create lending request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleAction = (req: LendingRequest) => {
    if (req.status === 'pending_admin_approval') {
      Alert.alert('Action', `Manage request from ${req.borrowerName}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => runStatusChange(req.id, 'approved') },
        { text: 'Decline', style: 'destructive', onPress: () => runStatusChange(req.id, 'declined') },
      ]);
    } else if (req.status === 'approved') {
      setPendingSettleId(req.id);
      setSettleRefNum('');
      setSettleModalVisible(true);
    }
  };

  const runStatusChange = async (id: string, status: LendingStatus, refNum?: string) => {
    try {
      await updateLendingStatus(id, status, refNum);
      await load();
    } catch (error) {
      Alert.alert('Unable to update request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleSettle = async () => {
    setSettleModalVisible(false);
    await runStatusChange(pendingSettleId, 'settled', settleRefNum);
  };

  const selectedLedger = ledgers.find((ledger) => ledger.id === selectedLedgerId);

  const getMonthlyPayment = () => {
    const amt = parseFloat(amount);
    const rate = parseFloat(interestRate);
    if (!isNaN(amt) && amt > 0 && !isNaN(rate) && rate > 0) {
      return formatAmount(amt * (rate / 100), selectedLedger?.baseCurrency ?? 'PHP');
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>{Labels.creditMonitor}</Text>
        <Text style={styles.headerSubtitle}>
          {lendingMetrics.pendingCount} pending · {lendingMetrics.approvedCount} active · {outstandingLabel}
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No lending requests yet.</Text>}
        renderItem={({ item }) => {
          const { daysOverdue, penaltyAmount } = getOverdueInfo(item);
          const monthlyInterest = item.interestRate > 0
            ? formatAmount(item.amount * (item.interestRate / 100), item.currency)
            : null;
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleAction(item)}>
              <View style={styles.cardTop}>
                <Text style={styles.borrowerName}>{item.borrowerName}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                  <Text style={styles.badgeText}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>
              <Text style={styles.cardAmount}>{formatAmount(item.amount, item.currency)}</Text>
              <Text style={styles.cardLedger}>Ledger: {ledgers.find((l) => l.id === item.ledgerId)?.name ?? 'Unknown'}</Text>
              <Text style={styles.cardTxn}>TXN: {item.transactionCode || '—'}</Text>
              {item.interestRate > 0 && (
                <Text style={styles.cardDetail}>Interest: {item.interestRate}%/mo · Monthly due: {monthlyInterest}</Text>
              )}
              {item.dueDate && (
                <Text style={styles.cardDetail}>Due: {item.dueDate}</Text>
              )}
              {daysOverdue > 0 && (
                <Text style={styles.overdueText}>
                  Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} · Penalty: {formatAmount(penaltyAmount, item.currency)} ({item.penaltyRate}%/day)
                </Text>
              )}
              {item.referenceNumber ? <Text style={styles.cardRef}>Ref: {item.referenceNumber}</Text> : null}
              {item.note ? <Text style={styles.cardNote}>{item.note}</Text> : null}
              <Text style={styles.cardDate}>{item.createdAt.split('T')[0]}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* New Lending Request Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>New Lending Request</Text>

            <Text style={styles.fieldLabel}>Ledger</Text>
            <View style={styles.ledgerPicker}>
              {ledgers.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.ledgerChip, selectedLedgerId === l.id && styles.ledgerChipActive]}
                  onPress={() => setSelectedLedgerId(l.id)}
                >
                  <Text style={[styles.ledgerChipText, selectedLedgerId === l.id && { color: '#fff' }]}>{l.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedLedger ? (
              <Text style={styles.availableBalance}>
                Available: {formatAmount(ledgerBalances[selectedLedger.id] ?? 0, selectedLedger.baseCurrency)}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Borrower Name</Text>
            <TextInput style={styles.input} placeholder="Full name" value={borrowerName} onChangeText={setBorrowerName} />

            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput style={styles.input} placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Monthly Interest Rate (%)</Text>
            <TextInput style={styles.input} placeholder="e.g. 2 for 2% per month (0 = none)" value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" />
            {getMonthlyPayment() ? (
              <Text style={styles.infoHint}>📌 Expected monthly interest: {getMonthlyPayment()}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Due Date (YYYY-MM-DD, optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. 2025-12-31" value={dueDate} onChangeText={setDueDate} />

            <Text style={styles.fieldLabel}>Penalty Rate (% per day after due, optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. 0.3 for 0.3% daily" value={penaltyRate} onChangeText={setPenaltyRate} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={styles.input} placeholder="Optional note" value={note} onChangeText={setNote} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { resetForm(); setModalVisible(false); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleAdd}>
                <Text style={styles.createText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Settle Modal */}
      <Modal visible={settleModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settleBox}>
            <Text style={styles.modalTitle}>Mark as Settled</Text>
            <Text style={styles.settleDesc}>Enter the reference number for this settlement (e.g. GCash ref, bank transfer ID).</Text>
            <Text style={styles.fieldLabel}>Reference Number (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. GC123456789"
              value={settleRefNum}
              onChangeText={setSettleRefNum}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettleModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleSettle}>
                <Text style={styles.createText}>Confirm Settled</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, padding: Spacing.lg },
  headerTitle: { color: '#fff', fontSize: FontSize.xl, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: FontSize.sm, marginTop: 4 },
  list: { padding: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  borrowerName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  cardAmount: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary },
  cardLedger: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  cardTxn: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, fontFamily: 'monospace' },
  cardDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  overdueText: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4, fontWeight: '600' },
  cardRef: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cardNote: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl, fontStyle: 'italic' },
  fab: {
    position: 'absolute', right: Spacing.lg, bottom: Spacing.lg,
    backgroundColor: Colors.primary, width: 56, height: 56,
    borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '90%' },
  settleBox: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, margin: Spacing.md, borderRadius: Radius.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  settleDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: 2 },
  infoHint: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2, marginBottom: 2 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary },
  ledgerPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  ledgerChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  ledgerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ledgerChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  availableBalance: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.xl },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  createBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '600' },
});
