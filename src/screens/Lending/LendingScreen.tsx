import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, FontSize, Labels } from '../../constants';
import {
  getLendingRequests,
  createLendingRequest,
  updateLendingStatus,
  getLendingPayments,
  recordLendingPayment,
  updateLendingRequestDetails,
} from '../../repositories/lendingRepository';
import { getLedgers, getLedgerBalance } from '../../repositories/ledgerRepository';
import { LendingPayment, LendingRequest, Ledger, LendingStatus } from '../../types';
import { formatAmount } from '../../data/currencies';
import { computeLendingBreakdown } from '../../utils/lending';
import { useThemeMode } from '../../theme/ThemeContext';

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

type LendingWithBreakdown = {
  request: LendingRequest;
  payments: LendingPayment[];
};

export default function LendingScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<LendingRequest[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerBalances, setLedgerBalances] = useState<Record<string, number>>({});
  const [paymentsByRequest, setPaymentsByRequest] = useState<Record<string, LendingPayment[]>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<LendingWithBreakdown | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBorrowerName, setEditBorrowerName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editTermMonths, setEditTermMonths] = useState('1');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPenaltyRate, setEditPenaltyRate] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editNote, setEditNote] = useState('');

  const [borrowerName, setBorrowerName] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('1');
  const [dueDate, setDueDate] = useState('');
  const [penaltyRate, setPenaltyRate] = useState('');
  const [note, setNote] = useState('');
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const darkSurface = '#1F252F';
  const darkText = '#E6E9EE';

  const shiftIsoDateByMonths = (dateValue: string, months: number): string => {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    parsed.setMonth(parsed.getMonth() + months);
    return parsed.toISOString().slice(0, 10);
  };

  const load = useCallback(async () => {
    const [rs, ls] = await Promise.all([getLendingRequests(), getLedgers()]);
    setRequests(rs);
    setLedgers(ls);
    const balances = await Promise.all(
      ls.map(async (ledger) => [ledger.id, await getLedgerBalance(ledger.id, ledger.baseCurrency)] as const)
    );
    setLedgerBalances(Object.fromEntries(balances));
    if (ls.length > 0 && !selectedLedgerId) setSelectedLedgerId(ls[0].id);

    const paymentRows = await Promise.all(
      rs.map(async (request) => [request.id, await getLendingPayments(request.id)] as const)
    );
    setPaymentsByRequest(Object.fromEntries(paymentRows));
  }, [selectedLedgerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const lendingMetrics = useMemo(() => {
    const pendingCount = requests.filter((request) => request.status === 'pending_admin_approval').length;
    const approvedCount = requests.filter((request) => request.status === 'approved').length;
    const settledCount = requests.filter((request) => request.status === 'settled').length;
    return { pendingCount, approvedCount, settledCount };
  }, [requests]);

  const outstandingLabel = useMemo(() => {
    const totals = requests.reduce<Record<string, number>>((summary, request) => {
      if (request.status !== 'approved') return summary;
      const payments = paymentsByRequest[request.id] ?? [];
      const amount = computeLendingBreakdown(request, payments).outstanding;
      summary[request.currency] = (summary[request.currency] ?? 0) + amount;
      return summary;
    }, {});
    const entries = Object.entries(totals);
    if (entries.length === 0) return 'No active loans';
    return entries.map(([currency, total]) => formatAmount(total, currency)).join(' · ');
  }, [requests, paymentsByRequest]);

  const resetForm = () => {
    setBorrowerName('');
    setAmount('');
    setInterestRate('');
    setTermMonths('1');
    setDueDate('');
    setPenaltyRate('');
    setNote('');
  };

  const handleAdd = async () => {
    if (!borrowerName.trim() || !amount.trim() || !selectedLedgerId) {
      Alert.alert('Missing fields', 'Please fill in borrower name, amount and select a ledger.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    const parsedInterest = parseFloat(interestRate) || 0;
    const parsedTerm = parseInt(termMonths, 10);
    const parsedPenalty = parseFloat(penaltyRate) || 0;
    const trimmedBorrowDate = dueDate.trim() || undefined;

    if (!Number.isFinite(parsedTerm) || parsedTerm < 1) {
      Alert.alert('Invalid term', 'Repayment term should be at least 1 month.');
      return;
    }
    if (trimmedBorrowDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedBorrowDate)) {
      Alert.alert('Invalid date', 'Please enter the borrow date in YYYY-MM-DD format.');
      return;
    }
    if (trimmedBorrowDate) {
      const parsed = new Date(trimmedBorrowDate);
      if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmedBorrowDate) {
        Alert.alert('Invalid date', 'The borrow date is not a valid calendar date. Please check the day and month values.');
        return;
      }
    }

    try {
      const ledger = ledgers.find((l) => l.id === selectedLedgerId);
      await createLendingRequest(
        selectedLedgerId,
        borrowerName.trim(),
        parsedAmount,
        ledger?.baseCurrency ?? 'PHP',
        parsedInterest,
        parsedTerm,
        trimmedBorrowDate ? shiftIsoDateByMonths(trimmedBorrowDate, 1) : undefined,
        parsedPenalty,
        undefined,
        note.trim() || undefined
      );
      resetForm();
      setModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('Unable to create lending request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const openDetails = async (request: LendingRequest) => {
    const payments = await getLendingPayments(request.id);
    setSelectedDetail({ request, payments });
    setDetailModalVisible(true);
  };

  const openEdit = (request: LendingRequest) => {
    setSelectedDetail((current) => (current?.request.id === request.id ? current : { request, payments: [] }));
    setEditBorrowerName(request.borrowerName);
    setEditAmount(String(request.amount));
    setEditInterestRate(String(request.interestRate));
    setEditTermMonths(String(request.termMonths));
    setEditDueDate(request.dueDate ? shiftIsoDateByMonths(request.dueDate, -1) : '');
    setEditPenaltyRate(String(request.penaltyRate));
    setEditReference(request.referenceNumber ?? '');
    setEditNote(request.note ?? '');
    setEditModalVisible(true);
  };

  const handleAction = (request: LendingRequest) => {
    if (request.status === 'pending_admin_approval') {
      Alert.alert('Action', `Manage request from ${request.borrowerName}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: () => openEdit(request) },
        { text: 'Approve', onPress: () => runStatusChange(request.id, 'approved') },
        { text: 'Decline', style: 'destructive', onPress: () => runStatusChange(request.id, 'declined') },
      ]);
      return;
    }
    openDetails(request);
  };

  const runStatusChange = async (id: string, status: LendingStatus, refNum?: string) => {
    try {
      await updateLendingStatus(id, status, refNum);
      await load();
    } catch (error) {
      Alert.alert('Unable to update request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const selectedLedger = ledgers.find((ledger) => ledger.id === selectedLedgerId);

  const getMonthlyPaymentPreview = () => {
    const amt = parseFloat(amount);
    const rate = parseFloat(interestRate);
    const months = parseInt(termMonths, 10);
    if (!isNaN(amt) && amt > 0 && !isNaN(rate) && rate >= 0 && !isNaN(months) && months > 0) {
      const monthlyInterest = amt * (rate / 100);
      return formatAmount((amt + monthlyInterest * months) / months, selectedLedger?.baseCurrency ?? 'PHP');
    }
    return null;
  };

  const selectedBreakdown = useMemo(() => {
    if (!selectedDetail) return null;
    return computeLendingBreakdown(selectedDetail.request, selectedDetail.payments);
  }, [selectedDetail]);

  const submitPayment = async () => {
    if (!selectedDetail) return;
    const parsed = parseFloat(paymentAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid payment', 'Please enter a valid payment amount.');
      return;
    }
    if (selectedBreakdown && parsed > selectedBreakdown.outstanding) {
      Alert.alert('Invalid payment', `Amount cannot be higher than remaining balance (${formatAmount(selectedBreakdown.outstanding, selectedDetail.request.currency)}).`);
      return;
    }

    try {
      await recordLendingPayment(
        selectedDetail.request.id,
        parsed,
        paymentReference.trim() || undefined,
        paymentNote.trim() || undefined
      );
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNote('');
      setPaymentModalVisible(false);
      const latestRequests = await getLendingRequests();
      const updatedRequest = latestRequests.find((r) => r.id === selectedDetail.request.id);
      const updatedPayments = await getLendingPayments(selectedDetail.request.id);
      if (updatedRequest) setSelectedDetail({ request: updatedRequest, payments: updatedPayments });
      await load();
    } catch (error) {
      Alert.alert('Unable to record payment', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const saveLendingEdit = async () => {
    if (!selectedDetail) return;
    try {
      await updateLendingRequestDetails(selectedDetail.request.id, {
        borrowerName: editBorrowerName,
        amount: parseFloat(editAmount) || 0,
        interestRate: parseFloat(editInterestRate) || 0,
        termMonths: parseInt(editTermMonths, 10) || 1,
        dueDate: editDueDate.trim() ? shiftIsoDateByMonths(editDueDate.trim(), 1) : undefined,
        penaltyRate: parseFloat(editPenaltyRate) || 0,
        referenceNumber: editReference.trim() || undefined,
        note: editNote.trim() || undefined,
      });
      setEditModalVisible(false);
      const latestRequests = await getLendingRequests();
      const updatedRequest = latestRequests.find((r) => r.id === selectedDetail.request.id);
      if (updatedRequest) {
        const updatedPayments = await getLendingPayments(updatedRequest.id);
        setSelectedDetail({ request: updatedRequest, payments: updatedPayments });
      }
      await load();
    } catch (error) {
      Alert.alert('Unable to update request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const confirmSaveLendingEdit = () => {
    Alert.alert(
      'Critical update warning',
      'Editing settlement details changes financial records and dashboard totals. Continue saving these changes?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save Changes', style: 'destructive', onPress: saveLendingEdit },
      ]
    );
  };

  const markInstallmentPaid = async (month: number) => {
    if (!selectedDetail || !selectedBreakdown) return;
    const installment = selectedBreakdown.installments.find((i) => i.month === month);
    if (!installment) return;
    const remaining = Math.max(0, installment.targetAmount - installment.paidAmount + installment.penaltyAmount);
    if (remaining <= 0) return;
    try {
      await recordLendingPayment(selectedDetail.request.id, remaining, undefined, `Installment month ${month} marked paid`);
      const updatedRequest = (await getLendingRequests()).find((request) => request.id === selectedDetail.request.id) ?? selectedDetail.request;
      const updatedPayments = await getLendingPayments(selectedDetail.request.id);
      setSelectedDetail({ request: updatedRequest, payments: updatedPayments });
      await load();
    } catch (error) {
      Alert.alert('Unable to update installment', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#12161D' }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>{Labels.creditMonitor}</Text>
        <Text style={styles.headerSubtitle}>
          {lendingMetrics.pendingCount} pending · {lendingMetrics.approvedCount} active · {outstandingLabel}
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(120, insets.bottom + 96) }]}
        ListEmptyComponent={<Text style={[styles.empty, isDark && { color: darkText }]}>No settlement requests yet.</Text>}
        renderItem={({ item }) => {
          const payments = paymentsByRequest[item.id] ?? [];
          const breakdown = computeLendingBreakdown(item, payments);
          return (
            <TouchableOpacity style={[styles.card, isDark && { backgroundColor: darkSurface }]} onPress={() => handleAction(item)}>
              <View style={styles.cardTop}>
                <Text style={[styles.borrowerName, isDark && { color: darkText }]}>{item.borrowerName}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                  <Text style={styles.badgeText}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>
              <Text style={[styles.cardAmount, isDark && { color: darkText }]}>{formatAmount(item.amount, item.currency)}</Text>
              <Text style={[styles.cardLedger, isDark && { color: '#B8C2D1' }]}>Cash Ledger: {ledgers.find((l) => l.id === item.ledgerId)?.name ?? 'Unknown'}</Text>
              <Text style={[styles.cardTxn, isDark && { color: '#94A3B8' }]}>TXN: {item.transactionCode || '—'}</Text>
              <Text style={[styles.cardDetail, isDark && { color: '#B8C2D1' }]}>Term: {item.termMonths} month{item.termMonths > 1 ? 's' : ''}</Text>
              <Text style={[styles.cardDetail, isDark && { color: '#B8C2D1' }]}>Monthly due: {formatAmount(breakdown.monthlyDue, item.currency)}</Text>
              <Text style={[styles.cardDetail, isDark && { color: '#B8C2D1' }]}>Outstanding: {formatAmount(breakdown.outstanding, item.currency)}</Text>
              {item.referenceNumber ? <Text style={[styles.cardRef, isDark && { color: '#B8C2D1' }]}>Ref: {item.referenceNumber}</Text> : null}
              {item.note ? <Text style={[styles.cardNote, isDark && { color: '#B8C2D1' }]}>{item.note}</Text> : null}
              <Text style={[styles.cardDate, isDark && { color: '#94A3B8' }]}>{item.createdAt.split('T')[0]}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + Spacing.lg }]} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>New Settlement Request</Text>

            <Text style={styles.fieldLabel}>Cash Ledger</Text>
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

            <Text style={styles.fieldLabel}>Repayment Term (months)</Text>
            <TextInput style={styles.input} placeholder="e.g. 6" value={termMonths} onChangeText={setTermMonths} keyboardType="number-pad" />

            {getMonthlyPaymentPreview() ? (
              <Text style={styles.infoHint}>Estimated monthly due: {getMonthlyPaymentPreview()}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Date Borrowed (YYYY-MM-DD, optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. 2026-12-31" value={dueDate} onChangeText={setDueDate} />

            <Text style={styles.fieldLabel}>Penalty Rate (% per day after missed monthly due)</Text>
            <TextInput style={styles.input} placeholder="e.g. 0.3" value={penaltyRate} onChangeText={setPenaltyRate} keyboardType="decimal-pad" />

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

      <Modal visible={detailModalVisible} animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={[styles.fullScreenModal, isDark && { backgroundColor: '#12161D' }, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.fullScreenHeader}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Settlement Details</Text>
            <TouchableOpacity style={styles.cancelBtnTight} onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={[styles.modalBox, styles.fullScreenContent, isDark && { backgroundColor: darkSurface }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
            keyboardShouldPersistTaps="handled"
          >
            {!selectedDetail || !selectedBreakdown ? null : (
              <>
                <Text style={[styles.modalTitle, isDark && { color: darkText }]}>{selectedDetail.request.borrowerName}</Text>
                <Text style={styles.detailSubtitle}>
                  Outstanding: {formatAmount(selectedBreakdown.outstanding, selectedDetail.request.currency)}
                </Text>
                <Text style={styles.cardDetail}>Principal remaining: {formatAmount(selectedBreakdown.principalRemaining, selectedDetail.request.currency)}</Text>
                <Text style={styles.cardDetail}>Accrued interest: {formatAmount(selectedBreakdown.accruedInterest, selectedDetail.request.currency)}</Text>
                <Text style={styles.cardDetail}>Future interest: {formatAmount(selectedBreakdown.futureInterest, selectedDetail.request.currency)}</Text>
                <Text style={styles.cardDetail}>Penalties: {formatAmount(selectedBreakdown.penalties, selectedDetail.request.currency)}</Text>
                {selectedBreakdown.cashbackIfPaidInFull > 0 ? (
                  <Text style={styles.cashbackText}>
                    Advance full-payment cashback available: {formatAmount(selectedBreakdown.cashbackIfPaidInFull, selectedDetail.request.currency)}
                  </Text>
                ) : null}

                <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
                {selectedBreakdown.installments.map((installment) => (
                  <View key={`${selectedDetail.request.id}_${installment.month}`} style={styles.installmentCard}>
                    <Text style={styles.installmentTitle}>Month {installment.month} • Due {installment.dueDate}</Text>
                    <Text style={styles.installmentMeta}>Due: {formatAmount(installment.targetAmount, selectedDetail.request.currency)}</Text>
                    <Text style={styles.installmentMeta}>Paid: {formatAmount(installment.paidAmount, selectedDetail.request.currency)}</Text>
                    <Text style={styles.installmentMeta}>Penalty: {formatAmount(installment.penaltyAmount, selectedDetail.request.currency)}</Text>
                    <Text style={[styles.installmentStatus, installment.status === 'overdue' && styles.overdueText]}>
                      Status: {installment.status}
                    </Text>
                    {selectedDetail.request.status === 'approved' && installment.status !== 'paid' ? (
                      <TouchableOpacity style={styles.markPaidBtn} onPress={() => markInstallmentPaid(installment.month)}>
                        <Text style={styles.markPaidBtnText}>Mark Paid</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Transactions</Text>
                {selectedDetail.payments.length === 0 ? (
                  <Text style={styles.empty}>No payments yet.</Text>
                ) : (
                  selectedDetail.payments.map((payment) => (
                    <View key={payment.id} style={styles.paymentCard}>
                      <Text style={styles.paymentAmount}>{formatAmount(payment.amountPaid, selectedDetail.request.currency)}</Text>
                      <Text style={styles.paymentMeta}>Principal: {formatAmount(payment.appliedPrincipal, selectedDetail.request.currency)}</Text>
                      <Text style={styles.paymentMeta}>Interest: {formatAmount(payment.appliedInterest, selectedDetail.request.currency)}</Text>
                      <Text style={styles.paymentMeta}>Penalty: {formatAmount(payment.appliedPenalty, selectedDetail.request.currency)}</Text>
                      {payment.cashbackAmount > 0 ? (
                        <Text style={styles.cashbackText}>Cashback applied: {formatAmount(payment.cashbackAmount, selectedDetail.request.currency)}</Text>
                      ) : null}
                      {payment.note ? <Text style={styles.paymentMeta}>{payment.note}</Text> : null}
                      <Text style={styles.cardDate}>{payment.paidAt.split('T')[0]}</Text>
                    </View>
                  ))
                )}

                {selectedDetail.request.status === 'approved' ? (
                  <TouchableOpacity style={styles.createBtn} onPress={() => setPaymentModalVisible(true)}>
                    <Text style={styles.createText}>Add Payment</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.editBtn, { marginBottom: Spacing.md }]} onPress={() => openEdit(selectedDetail.request)}>
                  <Text style={styles.editBtnText}>Edit Details</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.settleBox}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput style={styles.input} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" />
            <Text style={styles.fieldLabel}>Reference Number (optional)</Text>
            <TextInput style={styles.input} value={paymentReference} onChangeText={setPaymentReference} placeholder="e.g. GC123456789" />
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={styles.input} value={paymentNote} onChangeText={setPaymentNote} placeholder="e.g. advance partial payment" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={submitPayment}>
                <Text style={styles.createText}>Save Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={[styles.fullScreenModal, isDark && { backgroundColor: '#12161D' }, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.fullScreenHeader}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Edit Settlement Item</Text>
            <TouchableOpacity style={styles.cancelBtnTight} onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={[styles.modalBox, styles.fullScreenContent, isDark && { backgroundColor: darkSurface }]} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
            <Text style={styles.fieldLabel}>Borrower Name</Text>
            <TextInput style={styles.input} value={editBorrowerName} onChangeText={setEditBorrowerName} />
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Monthly Interest Rate (%)</Text>
            <TextInput style={styles.input} value={editInterestRate} onChangeText={setEditInterestRate} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Term (months)</Text>
            <TextInput style={styles.input} value={editTermMonths} onChangeText={setEditTermMonths} keyboardType="number-pad" />
            <Text style={styles.fieldLabel}>Date Borrowed (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={editDueDate} onChangeText={setEditDueDate} />
            <Text style={styles.fieldLabel}>Penalty Rate (% per day)</Text>
            <TextInput style={styles.input} value={editPenaltyRate} onChangeText={setEditPenaltyRate} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Reference Number</Text>
            <TextInput style={styles.input} value={editReference} onChangeText={setEditReference} />
            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput style={styles.input} value={editNote} onChangeText={setEditNote} />
            <View style={[styles.modalActions, { marginTop: Spacing.lg }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={confirmSaveLendingEdit}>
                <Text style={styles.createText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  overdueText: { color: Colors.danger, fontWeight: '700' },
  cardRef: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cardNote: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.md, fontStyle: 'italic' },
  fab: {
    position: 'absolute', right: Spacing.lg, bottom: Spacing.lg,
    backgroundColor: Colors.primary, width: 56, height: 56,
    borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  fullScreenModal: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.md },
  fullScreenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fullScreenContent: { flex: 1, borderRadius: Radius.lg },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '90%' },
  settleBox: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, margin: Spacing.md, borderRadius: Radius.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  detailSubtitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: 2 },
  infoHint: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2, marginBottom: 2 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary },
  ledgerPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  ledgerChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  ledgerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ledgerChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  availableBalance: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.md },
  cancelBtn: { flex: 1, minHeight: 48, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTight: { minHeight: 40, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  createBtn: { flex: 1, minHeight: 48, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#fff', fontWeight: '600' },
  editBtn: { marginTop: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  editBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  installmentCard: { backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.xs },
  installmentTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  installmentMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  installmentStatus: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  markPaidBtn: { alignSelf: 'flex-start', marginTop: Spacing.xs, backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  markPaidBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  paymentCard: { backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.xs },
  paymentAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  paymentMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cashbackText: { fontSize: FontSize.xs, color: Colors.primaryDark, marginTop: 2, fontWeight: '600' },
});
