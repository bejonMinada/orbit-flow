import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius, FontSize } from '../../constants';
import { getEntries, deleteEntry, getLedgerBalance } from '../../repositories/ledgerRepository';
import { Entry } from '../../types';
import { LedgersStackParamList } from '../../navigation/LedgersNavigator';
import { formatAmount } from '../../data/currencies';
import { SYSTEM_CATEGORIES } from '../../data/categories';

type Props = NativeStackScreenProps<LedgersStackParamList, 'LedgerDetail'>;

export default function LedgerDetailScreen({ route, navigation }: Props) {
  const { ledgerId, currency } = route.params;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balance, setBalance] = useState(0);

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
    Alert.alert('Delete Entry', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteEntry(id); load(); } },
    ]);
  };

  const getCategoryName = (id: string) =>
    SYSTEM_CATEGORIES.find((c) => c.id === id)?.name ?? id;

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
        ListEmptyComponent={<Text style={styles.empty}>No entries yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.entry} onLongPress={() => handleDelete(item.id)}>
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
});
