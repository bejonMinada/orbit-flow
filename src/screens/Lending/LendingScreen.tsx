import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize, Labels } from '../../constants';
import { getLendingRequests, createLendingRequest, updateLendingStatus } from '../../repositories/lendingRepository';
import { getLedgers, getLedgerBalance } from '../../repositories/ledgerRepository';
import { LendingRequest, Ledger, LendingStatus } from '../../types';
import { formatAmount } from '../../data/currencies';
import { getLendingMetrics } from '../../utils/lending';

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

export default function LendingScreen() {
  const [requests, setRequests] = useState<LendingRequest[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerBalances, setLedgerBalances] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [amount, setAmount] = useState('');
  const [refNum, setRefNum] = useState('');
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

  const handleAdd = async () => {
    if (!borrowerName.trim() || !amount.trim() || !selectedLedgerId) {
      Alert.alert('Missing fields', 'Please fill in borrower name, amount and select a ledger.');
      return;
    }
    try {
      const parsedAmount = parseFloat(amount);
      const ledger = ledgers.find((l) => l.id === selectedLedgerId);
      await createLendingRequest(selectedLedgerId, borrowerName.trim(), parsedAmount, ledger?.baseCurrency ?? 'PHP', refNum.trim(), undefined, note.trim());
      setBorrowerName(''); setAmount(''); setRefNum(''); setNote('');
      setModalVisible(false);
      load();
    } catch (error) {
      Alert.alert('Unable to create lending request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleAction = (req: LendingRequest) => {
    const runAction = async (status: LendingStatus) => {
      try {
        await updateLendingStatus(req.id, status);
        await load();
      } catch (error) {
        Alert.alert('Unable to update request', error instanceof Error ? error.message : 'Please try again.');
      }
    };

    if (req.status === 'pending_admin_approval') {
      Alert.alert('Action', `Manage request from ${req.borrowerName}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => runAction('approved') },
        { text: 'Decline', style: 'destructive', onPress: () => runAction('declined') },
      ]);
    } else if (req.status === 'approved') {
      Alert.alert('Mark Settled?', `Mark this as settled?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Settled', onPress: () => runAction('settled') },
      ]);
    }
  };

  const selectedLedger = ledgers.find((ledger) => ledger.id === selectedLedgerId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{Labels.creditMonitor}</Text>
        <Text style={styles.headerSubtitle}>
          {lendingMetrics.pendingCount} pending · {lendingMetrics.approvedCount} active · {formatAmount(lendingMetrics.outstandingAmount, 'PHP')} outstanding
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No lending requests yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleAction(item)}>
            <View style={styles.cardTop}>
              <Text style={styles.borrowerName}>{item.borrowerName}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                <Text style={styles.badgeText}>{STATUS_LABEL[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.cardAmount}>{formatAmount(item.amount, item.currency)}</Text>
            <Text style={styles.cardLedger}>Ledger: {ledgers.find((ledger) => ledger.id === item.ledgerId)?.name ?? 'Unknown'}</Text>
            {item.referenceNumber ? <Text style={styles.cardRef}>Ref: {item.referenceNumber}</Text> : null}
            {item.note ? <Text style={styles.cardNote}>{item.note}</Text> : null}
            <Text style={styles.cardDate}>{item.createdAt.split('T')[0]}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

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
                  Available balance in {selectedLedger.name}: {formatAmount(ledgerBalances[selectedLedger.id] ?? 0, selectedLedger.baseCurrency)}
                </Text>
              ) : null}

            {[
              { label: 'Borrower Name', value: borrowerName, onChange: setBorrowerName, placeholder: 'Full name' },
              { label: 'Amount', value: amount, onChange: setAmount, placeholder: '0.00', keyboard: 'decimal-pad' as const },
              { label: 'Reference Number', value: refNum, onChange: setRefNum, placeholder: 'Optional ref' },
              { label: 'Note', value: note, onChange: setNote, placeholder: 'Optional note' },
            ].map((f) => (
              <View key={f.label}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput style={styles.input} placeholder={f.placeholder} value={f.value} onChangeText={f.onChange} keyboardType={f.keyboard} />
              </View>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleAdd}>
                <Text style={styles.createText}>Submit</Text>
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
  header: { backgroundColor: Colors.primary, padding: Spacing.lg, paddingTop: Spacing.xl },
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
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: 2 },
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
