import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { formatAmount, getCurrency } from '../../data/currencies';
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
const MIN_LIST_BOTTOM_PADDING = 120;
const FAB_CLEARANCE = 96;

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
  const [savingPayment, setSavingPayment] = useState(false);
  const [processingInstallmentMonth, setProcessingInstallmentMonth] = useState<number | null>(null);
  const installmentLockSetRef = useRef<Set<string>>(new Set());
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
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showEditDueDatePicker, setShowEditDueDatePicker] = useState(false);
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const darkSurface = '#1F252F';
  const darkSurfaceAlt = '#2A3240';
  const darkBorder = '#334155';
  const darkText = '#E6E9EE';
  const darkMuted = '#B8C2D1';

  const addMonthsWithDayClamp = (dateValue: string, months: number): string => {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    const day = parsed.getDate();
    const shifted = new Date(parsed);
    shifted.setDate(1);
    shifted.setMonth(shifted.getMonth() + months);
    const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
    shifted.setDate(Math.min(day, lastDay));
    return shifted.toISOString().slice(0, 10);
  };

  const parseISODateString = (dateValue: string): Date | undefined => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return undefined;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateValue) return undefined;
    return parsed;
  };

  const onDueDatePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowDueDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setDueDate(selectedDate.toISOString().slice(0, 10));
    }
  };

  const onEditDueDatePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowEditDueDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setEditDueDate(selectedDate.toISOString().slice(0, 10));
    }
  };

  const getSettlementThreshold = (currency: string): number => {
    const minorUnits = getCurrency(currency)?.minorUnits ?? 2;
    return 1 / (10 ** minorUnits);
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
      Alert.alert('Missing fields', 'Please fill in borrower\'s name, amount and select a ledger.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    const parsedInterest = parseFloat(interestRate) || 0;
    const parsedTerm = parseInt(termMonths, 10);
    const parsedPenalty = parseFloat(penaltyRate) || 0;
    const trimmedDueDate = dueDate.trim() || undefined;

    if (!Number.isFinite(parsedTerm) || parsedTerm < 1) {
      Alert.alert('Invalid term', 'Repayment term should be at least 1 month.');
      return;
    }
    if (trimmedDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDueDate)) {
      Alert.alert('Invalid date', 'Please enter the borrow date in YYYY-MM-DD format.');
      return;
    }
    if (trimmedDueDate) {
      const parsed = new Date(trimmedDueDate);
      if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmedDueDate) {
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
        trimmedDueDate ? addMonthsWithDayClamp(trimmedDueDate, 1) : undefined,
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
    setEditDueDate(request.dueDate ? addMonthsWithDayClamp(request.dueDate, -1) : '');
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
    if (!selectedDetail || savingPayment) return;
    const parsed = parseFloat(paymentAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid payment', 'Please enter a valid payment amount.');
      return;
    }
    if (selectedBreakdown && parsed > selectedBreakdown.outstanding) {
      Alert.alert('Invalid payment', `Amount cannot be higher than remaining balance (${formatAmount(selectedBreakdown.outstanding, selectedDetail.request.currency)})`);
      return;
    }

    try {
      setSavingPayment(true);
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
    } finally {
      setSavingPayment(false);
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
        dueDate: editDueDate.trim() ? addMonthsWithDayClamp(editDueDate.trim(), 1) : undefined,
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
    if (!selectedDetail || !selectedBreakdown || processingInstallmentMonth !== null) return;
    const requestId = selectedDetail.request.id;
    const lockKey = `${requestId}:${month}`;
    if (installmentLockSetRef.current.has(lockKey)) return;

    try {
      installmentLockSetRef.current.add(lockKey);
      setProcessingInstallmentMonth(month);
      const latestRequests = await getLendingRequests();
      const latestRequest = latestRequests.find((request) => request.id === requestId) ?? selectedDetail.request;
      const latestPayments = await getLendingPayments(requestId);
      const latestBreakdown = computeLendingBreakdown(latestRequest, latestPayments);
      const installment = latestBreakdown.installments.find((i) => i.month === month);
      if (!installment) return;

      const threshold = getSettlementThreshold(latestRequest.currency);
      const remainingRaw = Math.max(0, (installment.targetAmount + installment.penaltyAmount) - installment.paidAmount);
      const remaining = remainingRaw <= threshold ? 0 : remainingRaw;
      if (remaining <= 0) {
        setSelectedDetail({ request: latestRequest, payments: latestPayments });
        return;
      }

      await recordLendingPayment(requestId, remaining, undefined, `Installment month ${month} marked paid`);
      const updatedRequest = (await getLendingRequests()).find((request) => request.id === requestId) ?? latestRequest;
      const updatedPayments = await getLendingPayments(requestId);
      setSelectedDetail({ request: updatedRequest, payments: updatedPayments });
      await load();
    } catch (error) {
      Alert.alert('Unable to update installment', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      installmentLockSetRef.current.delete(lockKey);
      setProcessingInstallmentMonth(null);
    }
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#12161D' }]}>
      <View style={[styles.header, isDark && { backgroundColor: '#12161D', borderBottomColor: darkBorder }, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={[styles.headerTitle, isDark && { color: darkText }]}>{Labels.creditMonitor}</Text>
        <Text style={[styles.headerSubtitle, isDark && { color: darkMuted }]}>
          {lendingMetrics.pendingCount} pending · {lendingMetrics.approvedCount} active · {outstandingLabel}
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(MIN_LIST_BOTTOM_PADDING, insets.bottom + FAB_CLEARANCE) }]}
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
          <ScrollView style={[styles.modalBox, isDark && { backgroundColor: darkSurface }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>New Settlement Request</Text>

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Cash Ledger</Text>
            <View style={styles.ledgerPicker}>
              {ledgers.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.ledgerChip, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder }, selectedLedgerId === l.id && styles.ledgerChipActive]}
                  onPress={() => setSelectedLedgerId(l.id)}
                >
                  <Text style={[styles.ledgerChipText, selectedLedgerId === l.id && { color: '#fff' }]}>{l.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedLedger ? (
              <Text style={[styles.availableBalance, isDark && { color: darkMuted }]}>
                Available: {formatAmount(ledgerBalances[selectedLedger.id] ?? 0, selectedLedger.baseCurrency)}
              </Text>
            ) : null}

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Borrower’s Name</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} placeholder="Full name" placeholderTextColor={isDark ? darkMuted : undefined} value={borrowerName} onChangeText={setBorrowerName} />

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Amount</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} placeholder="0.00" placeholderTextColor={isDark ? darkMuted : undefined} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Monthly Interest Rate (%)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} placeholder="e.g. 2 for 2% per month (0 = none)" placeholderTextColor={isDark ? darkMuted : undefined} value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" />

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Repayment Term (months)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} placeholder="e.g. 6" placeholderTextColor={isDark ? darkMuted : undefined} value={termMonths} onChangeText={setTermMonths} keyboardType="number-pad" />

            {getMonthlyPaymentPreview() ? (
              <Text style={[styles.infoHint, isDark && { color: darkText }]}>Estimated monthly due: {getMonthlyPaymentPreview()}</Text>
            ) : null}

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Date Borrowed (optional)</Text>
            <TouchableOpacity
              style={[styles.input, styles.dateInputTrigger, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder }]}
              onPress={() => setShowDueDatePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dateInputText, !dueDate && styles.datePlaceholder, isDark && { color: dueDate ? darkText : darkMuted }]}>
                {dueDate || 'Select date from calendar'}
              </Text>
            </TouchableOpacity>
            {dueDate ? (
              <TouchableOpacity onPress={() => setDueDate('')}>
                <Text style={styles.clearDateText}>Clear date</Text>
              </TouchableOpacity>
            ) : null}
            {showDueDatePicker ? (
              <DateTimePicker
                value={parseISODateString(dueDate) ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDueDatePickerChange}
              />
            ) : null}

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Penalty Rate (% per day after missed monthly due)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} placeholder="e.g. 0.3" placeholderTextColor={isDark ? darkMuted : undefined} value={penaltyRate} onChangeText={setPenaltyRate} keyboardType="decimal-pad" />

            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Note (optional)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} placeholder="Optional note" placeholderTextColor={isDark ? darkMuted : undefined} value={note} onChangeText={setNote} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, isDark && { backgroundColor: '#2A3240', borderColor: darkBorder, borderWidth: 1 }]} onPress={() => { resetForm(); setModalVisible(false); }}>
                <Text style={[styles.cancelText, isDark && { color: darkText }]}>Cancel</Text>
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
            <View style={styles.fullScreenHeaderRight}>
              {selectedDetail?.request.status === 'approved' ? (
                <TouchableOpacity style={[styles.headerActionBtn, isDark && { backgroundColor: Colors.primaryDark }]} onPress={() => setPaymentModalVisible(true)}>
                  <Text style={[styles.headerActionBtnText, isDark && { color: '#F1F5F9' }]}>Add Payment</Text>
                </TouchableOpacity>
              ) : null}
              {selectedDetail ? (
                <TouchableOpacity style={[styles.headerEditBtn, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]} onPress={() => openEdit(selectedDetail.request)}>
                  <Text style={[styles.headerEditBtnText, isDark && { color: darkText }]}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.cancelBtnTight, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]} onPress={() => setDetailModalVisible(false)}>
                <Text style={[styles.cancelText, isDark && { color: darkText }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            style={[styles.modalBox, styles.fullScreenContent, isDark && { backgroundColor: darkSurface }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
            keyboardShouldPersistTaps="handled"
          >
            {!selectedDetail || !selectedBreakdown ? null : (
              <>
                <Text style={[styles.modalTitle, isDark && { color: darkText }]}>{selectedDetail.request.borrowerName}</Text>
                <Text style={[styles.detailSubtitle, isDark && { color: '#7DD3FC' }]}>
                  Outstanding: {formatAmount(selectedBreakdown.outstanding, selectedDetail.request.currency)}
                </Text>
                <Text style={[styles.cardDetail, isDark && { color: darkMuted }]}>Principal remaining: {formatAmount(selectedBreakdown.principalRemaining, selectedDetail.request.currency)}</Text>
                <Text style={[styles.cardDetail, isDark && { color: darkMuted }]}>Accrued interest: {formatAmount(selectedBreakdown.accruedInterest, selectedDetail.request.currency)}</Text>
                <Text style={[styles.cardDetail, isDark && { color: darkMuted }]}>Future interest: {formatAmount(selectedBreakdown.futureInterest, selectedDetail.request.currency)}</Text>
                <Text style={[styles.cardDetail, isDark && { color: darkMuted }]}>Penalties: {formatAmount(selectedBreakdown.penalties, selectedDetail.request.currency)}</Text>

                <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Monthly Breakdown</Text>
                {selectedBreakdown.installments.map((installment) => (
                  (() => {
                    const threshold = getSettlementThreshold(selectedDetail.request.currency);
                    const remaining = Math.max(0, (installment.targetAmount + installment.penaltyAmount) - installment.paidAmount);
                    const actionable = remaining > threshold;
                    const shouldShowMarkPaid = selectedDetail.request.status === 'approved'
                      && installment.status !== 'paid'
                      && actionable;
                    return (
                      <View key={`${selectedDetail.request.id}_${installment.month}`} style={[styles.installmentCard, isDark && { backgroundColor: darkSurfaceAlt }]}>
                        <Text style={[styles.installmentTitle, isDark && { color: darkText }]}>Month {installment.month} • Due {installment.dueDate}</Text>
                        <Text style={[styles.installmentMeta, isDark && { color: darkMuted }]}>Due: {formatAmount(installment.targetAmount, selectedDetail.request.currency)}</Text>
                        <Text style={[styles.installmentMeta, isDark && { color: darkMuted }]}>Paid: {formatAmount(installment.paidAmount, selectedDetail.request.currency)}</Text>
                        <Text style={[styles.installmentMeta, isDark && { color: darkMuted }]}>Penalty: {formatAmount(installment.penaltyAmount, selectedDetail.request.currency)}</Text>
                        <Text style={[styles.installmentStatus, isDark && { color: darkMuted }, installment.status === 'overdue' && styles.overdueText]}>
                          Status: {installment.status}
                        </Text>
                        {shouldShowMarkPaid ? (
                          <TouchableOpacity
                            style={[styles.markPaidBtn, processingInstallmentMonth === installment.month && styles.disabledBtn]}
                            onPress={() => markInstallmentPaid(installment.month)}
                            disabled={processingInstallmentMonth !== null}
                          >
                            <Text style={styles.markPaidBtnText}>
                              {processingInstallmentMonth === installment.month ? 'Processing...' : 'Mark Paid'}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })()
                ))}

                <Text style={[styles.sectionTitle, isDark && { color: darkText }]}>Transactions</Text>
                {selectedDetail.payments.length === 0 ? (
                  <Text style={[styles.empty, isDark && { color: darkMuted }]}>No payments yet.</Text>
                ) : (
                  selectedDetail.payments.map((payment) => (
                    <View key={payment.id} style={[styles.paymentCard, isDark && { backgroundColor: darkSurfaceAlt }]}>
                      <Text style={[styles.paymentAmount, isDark && { color: darkText }]}>{formatAmount(payment.amountPaid, selectedDetail.request.currency)}</Text>
                      <Text style={[styles.paymentMeta, isDark && { color: darkMuted }]}>Principal: {formatAmount(payment.appliedPrincipal, selectedDetail.request.currency)}</Text>
                      <Text style={[styles.paymentMeta, isDark && { color: darkMuted }]}>Interest: {formatAmount(payment.appliedInterest, selectedDetail.request.currency)}</Text>
                      <Text style={[styles.paymentMeta, isDark && { color: darkMuted }]}>Penalty: {formatAmount(payment.appliedPenalty, selectedDetail.request.currency)}</Text>
                      {payment.note ? <Text style={[styles.paymentMeta, isDark && { color: darkMuted }]}>{payment.note}</Text> : null}
                      <Text style={[styles.cardDate, isDark && { color: '#94A3B8' }]}>{payment.paidAt.split('T')[0]}</Text>
                    </View>
                  ))
                )}

              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.settleBox, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Record Payment</Text>
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Amount</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={isDark ? darkMuted : undefined} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Reference Number (optional)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={paymentReference} onChangeText={setPaymentReference} placeholder="e.g. GC123456789" placeholderTextColor={isDark ? darkMuted : undefined} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Note (optional)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={paymentNote} onChangeText={setPaymentNote} placeholder="e.g. advance partial payment" placeholderTextColor={isDark ? darkMuted : undefined} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]} onPress={() => setPaymentModalVisible(false)}>
                <Text style={[styles.cancelText, isDark && { color: darkText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.createBtn, savingPayment && styles.disabledBtn]} onPress={submitPayment} disabled={savingPayment}>
                <Text style={styles.createText}>{savingPayment ? 'Saving...' : 'Save Payment'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={[styles.fullScreenModal, isDark && { backgroundColor: '#12161D' }, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.fullScreenHeader}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Edit Settlement Item</Text>
            <TouchableOpacity style={[styles.cancelBtnTight, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]} onPress={() => setEditModalVisible(false)}>
              <Text style={[styles.cancelText, isDark && { color: darkText }]}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={[styles.modalBox, styles.fullScreenContent, isDark && { backgroundColor: darkSurface }]} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Borrower’s Name</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editBorrowerName} onChangeText={setEditBorrowerName} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Amount</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Monthly Interest Rate (%)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editInterestRate} onChangeText={setEditInterestRate} keyboardType="decimal-pad" />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Term (months)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editTermMonths} onChangeText={setEditTermMonths} keyboardType="number-pad" />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Date Borrowed</Text>
            <TouchableOpacity
              style={[styles.input, styles.dateInputTrigger, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder }]}
              onPress={() => setShowEditDueDatePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dateInputText, !editDueDate && styles.datePlaceholder, isDark && { color: editDueDate ? darkText : darkMuted }]}>
                {editDueDate || 'Select date from calendar'}
              </Text>
            </TouchableOpacity>
            {editDueDate ? (
              <TouchableOpacity onPress={() => setEditDueDate('')}>
                <Text style={styles.clearDateText}>Clear date</Text>
              </TouchableOpacity>
            ) : null}
            {showEditDueDatePicker ? (
              <DateTimePicker
                value={parseISODateString(editDueDate) ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onEditDueDatePickerChange}
              />
            ) : null}
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Penalty Rate (% per day)</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editPenaltyRate} onChangeText={setEditPenaltyRate} keyboardType="decimal-pad" />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Reference Number</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editReference} onChangeText={setEditReference} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Note</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editNote} onChangeText={setEditNote} />
            <View style={[styles.modalActions, { marginTop: Spacing.lg }]}>
              <TouchableOpacity style={[styles.cancelBtn, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.cancelText, isDark && { color: darkText }]}>Cancel</Text>
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
  header: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  headerSubtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 },
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
  fullScreenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  fullScreenHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginLeft: Spacing.md },
  headerActionBtn: { minHeight: 40, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerActionBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  headerEditBtn: { minHeight: 40, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerEditBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700' },
  fullScreenContent: { flex: 1, borderRadius: Radius.lg },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '90%' },
  settleBox: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, margin: Spacing.md, borderRadius: Radius.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  detailSubtitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: 2 },
  infoHint: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2, marginBottom: 2 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary },
  dateInputTrigger: { minHeight: 44, justifyContent: 'center' },
  dateInputText: { fontSize: FontSize.md, color: Colors.textPrimary },
  datePlaceholder: { color: Colors.textMuted },
  clearDateText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600', marginTop: 4 },
  ledgerPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  ledgerChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  ledgerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ledgerChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  availableBalance: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.md },
  cancelBtn: { flex: 1, minHeight: 48, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTight: { minHeight: 40, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  createBtn: { flex: 1, minHeight: 48, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#fff', fontWeight: '600' },
  disabledBtn: { opacity: 0.65 },
  editBtn: { marginTop: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  editBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  installmentCard: { backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.xs },
  installmentTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  installmentMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  installmentStatus: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  markPaidBtn: { alignSelf: 'flex-start', marginTop: Spacing.xs, backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  markPaidBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  paymentCard: { backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.xs },
  paymentAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  paymentMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
