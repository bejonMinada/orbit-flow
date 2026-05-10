import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius, FontSize } from '../../constants';
import { getEntries, deleteEntry, getLedgerBalance, updateEntry } from '../../repositories/ledgerRepository';
import { Entry } from '../../types';
import { LedgersStackParamList } from '../../navigation/LedgersNavigator';
import { formatAmount } from '../../data/currencies';
import { SYSTEM_CATEGORIES } from '../../data/categories';

type Props = NativeStackScreenProps<LedgersStackParamList, 'LedgerDetail'>;

export default function LedgerDetailScreen({ route, navigation }: Props) {
  const { ledgerId, currency } = route.params;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balance, setBalance] = useState(0);
  const [editVisible, setEditVisible] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [editKind, setEditKind] = useState<Entry['kind']>('cash_out');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('cat_other');

  const load = useCallback(async () => {
    const [es, bal] = await Promise.all([
      getEntries(ledgerId),
      getLedgerBalance(ledgerId, currency),
    ]);
    setEntries(es);
    setBalance(bal);
  }, [ledgerId, currency]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'Remove this transaction from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteEntry(id); load(); } },
    ]);
  };

  const getCategoryName = (id: string) =>
    SYSTEM_CATEGORIES.find((c) => c.id === id)?.name ?? id;

  const openEditor = (entry: Entry) => {
    setSelectedEntryId(entry.id);
    setEditKind(entry.kind);
    setEditAmount(String(entry.amount));
    setEditNote(entry.note);
    setEditCategoryId(entry.categoryId);
    setEditVisible(true);
  };

  const handleUpdate = () => {
    const parsed = parseFloat(editAmount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid positive amount.');
      return;
    }
    Alert.alert(
      'Edit Transaction',
      'This will recalculate your dashboard totals and balance immediately. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Changes',
          onPress: async () => {
            await updateEntry(selectedEntryId, {
              kind: editKind,
              amount: parsed,
              note: editNote.trim(),
              categoryId: editCategoryId,
            });
            setEditVisible(false);
            load();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.balanceBar, { backgroundColor: balance >= 0 ? Colors.cashIn : Colors.cashOut }]}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceAmount}>{formatAmount(balance, currency)}</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
          renderItem={({ item }) => (
          <TouchableOpacity style={styles.entry} onPress={() => openEditor(item)} onLongPress={() => handleDelete(item.id)}>
            <View style={[styles.kindDot, { backgroundColor: item.kind === 'cash_in' ? Colors.cashIn : Colors.cashOut }]} />
            <View style={styles.entryMid}>
              <Text style={styles.entryNote}>{item.note || getCategoryName(item.categoryId)}</Text>
              <Text style={styles.entryDate}>{item.occurredAt.split('T')[0]} · {getCategoryName(item.categoryId)}</Text>
            </View>
            <Text style={[styles.entryAmount, { color: item.kind === 'cash_in' ? Colors.cashIn : Colors.cashOut }]}>
              {item.kind === 'cash_in' ? '+' : '-'}{formatAmount(item.amount, item.currency)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddEntry', { ledgerId, currency })}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={editVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Transaction</Text>
            <Text style={styles.warningText}>Warning: edits affect dashboard totals and history accuracy.</Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.toggle}>
              {(['cash_in', 'cash_out'] as Entry['kind'][]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.toggleBtn, editKind === k && { backgroundColor: k === 'cash_in' ? Colors.cashIn : Colors.cashOut }]}
                  onPress={() => setEditKind(k)}
                >
                  <Text style={[styles.toggleText, editKind === k && styles.toggleTextActive]}>
                    {k === 'cash_in' ? 'Cash In' : 'Cash Out'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount ({currency})</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={editAmount}
              onChangeText={setEditAmount}
            />

            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional note"
              value={editNote}
              onChangeText={setEditNote}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.categories}>
              {SYSTEM_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, editCategoryId === cat.id && { backgroundColor: cat.color }]}
                  onPress={() => setEditCategoryId(cat.id)}
                >
                  <Text style={[styles.catName, editCategoryId === cat.id && { color: '#fff' }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
                <Text style={styles.saveText}>Save</Text>
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
  balanceBar: { padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.md },
  balanceAmount: { color: '#fff', fontSize: FontSize.xxl, fontWeight: 'bold' },
  list: { padding: Spacing.md, paddingBottom: 100 },
  entry: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  kindDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.sm },
  entryMid: { flex: 1 },
  entryNote: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  entryDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  entryAmount: { fontSize: FontSize.md, fontWeight: 'bold' },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl, fontStyle: 'italic' },
  fab: {
    position: 'absolute', right: Spacing.lg, bottom: Spacing.lg,
    backgroundColor: Colors.primary, width: 56, height: 56,
    borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  warningText: { color: Colors.warning, fontSize: FontSize.xs, marginTop: 6 },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.surfaceAlt,
  },
  toggle: { flexDirection: 'row', gap: Spacing.sm },
  toggleBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface,
  },
  toggleText: { fontWeight: '600', color: Colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  catChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.border,
  },
  catName: { fontSize: FontSize.xs, color: Colors.textSecondary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
});
