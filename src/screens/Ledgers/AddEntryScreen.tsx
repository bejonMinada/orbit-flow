import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius, FontSize } from '../../constants';
import { createEntry } from '../../repositories/ledgerRepository';
import { LedgersStackParamList } from '../../navigation/LedgersNavigator';
import { SYSTEM_CATEGORIES } from '../../data/categories';
import { EntryKind } from '../../types';

type Props = NativeStackScreenProps<LedgersStackParamList, 'AddEntry'>;

export default function AddEntryScreen({ route, navigation }: Props) {
  const { ledgerId, currency } = route.params;
  const [kind, setKind] = useState<EntryKind>('cash_out');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('cat_other');

  const handleSave = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid positive amount.');
      return;
    }
    await createEntry(ledgerId, kind, parsed, currency, categoryId, note);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Type</Text>
      <View style={styles.toggle}>
        {(['cash_in', 'cash_out'] as EntryKind[]).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.toggleBtn, kind === k && { backgroundColor: k === 'cash_in' ? Colors.cashIn : Colors.cashOut }]}
            onPress={() => setKind(k)}
          >
            <Text style={[styles.toggleText, kind === k && styles.toggleTextActive]}>
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
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>Note</Text>
      <TextInput
        style={styles.input}
        placeholder="Optional note"
        value={note}
        onChangeText={setNote}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.categories}>
        {SYSTEM_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, categoryId === cat.id && { backgroundColor: cat.color }]}
            onPress={() => setCategoryId(cat.id)}
          >
            <Text style={styles.catEmoji}>{cat.icon}</Text>
            <Text style={[styles.catName, categoryId === cat.id && { color: '#fff' }]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save Transaction</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.surface,
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
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.border,
  },
  catEmoji: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  catName: { fontSize: FontSize.xs, color: Colors.textSecondary },
  saveBtn: { marginTop: Spacing.xl, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: 'bold' },
});
