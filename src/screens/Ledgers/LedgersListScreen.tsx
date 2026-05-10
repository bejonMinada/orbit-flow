import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius, FontSize } from '../../constants';
import { getLedgers, createLedger, deleteLedger, getLedgerBalance } from '../../repositories/ledgerRepository';
import { Ledger } from '../../types';
import { LedgersStackParamList } from '../../navigation/LedgersNavigator';
import { formatAmount } from '../../data/currencies';

type Props = NativeStackScreenProps<LedgersStackParamList, 'LedgersList'>;

export default function LedgersListScreen({ navigation }: Props) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState('PHP');

  const load = useCallback(async () => {
    const ls = await getLedgers();
    setLedgers(ls);
    const bals: Record<string, number> = {};
    for (const l of ls) {
      bals[l.id] = await getLedgerBalance(l.id, l.baseCurrency);
    }
    setBalances(bals);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createLedger(newName.trim(), newCurrency.trim() || 'PHP');
      setNewName('');
      setNewCurrency('PHP');
      setModalVisible(false);
      load();
    } catch (error) {
      Alert.alert('Unable to create ledger', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Ledger', `Delete "${name}" and all its entries?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteLedger(id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={ledgers}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No ledgers yet. Tap + to create one.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('LedgerDetail', { ledgerId: item.id, ledgerName: item.name, currency: item.baseCurrency })}
            onLongPress={() => handleDelete(item.id, item.name)}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardCurrency}>{item.baseCurrency}</Text>
            </View>
            <Text style={[styles.cardBalance, { color: (balances[item.id] ?? 0) >= 0 ? Colors.cashIn : Colors.cashOut }]}>
              {formatAmount(balances[item.id] ?? 0, item.baseCurrency)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Cash Ledger</Text>
            <TextInput style={styles.input} placeholder="Ledger name" value={newName} onChangeText={setNewName} />
            <TextInput style={styles.input} placeholder="Currency (e.g. PHP)" value={newCurrency} onChangeText={setNewCurrency} autoCapitalize="characters" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleAdd}>
                <Text style={styles.createText}>Create</Text>
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
  list: { padding: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardLeft: { flex: 1 },
  cardName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  cardCurrency: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardBalance: { fontSize: FontSize.lg, fontWeight: 'bold' },
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
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.md },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  createBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '600' },
});
