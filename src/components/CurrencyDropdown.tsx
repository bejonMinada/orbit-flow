import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, TextInput,
} from 'react-native';
import { CURRENCIES } from '../data/currencies';
import { Colors, FontSize, Radius, Spacing } from '../constants';

type Props = {
  value: string;
  onChange: (currency: string) => void;
  label?: string;
  popularOnly?: boolean;
};

const POPULAR = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'INR', 'MYR', 'IDR'];

export default function CurrencyDropdown({
  value,
  onChange,
  label = 'Currency',
  popularOnly = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const source = popularOnly ? CURRENCIES.filter((c) => POPULAR.includes(c.code)) : CURRENCIES;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((currency) =>
      currency.code.toLowerCase().includes(q) || currency.name.toLowerCase().includes(q)
    );
  }, [popularOnly, query]);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.arrow}>v</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>Select Currency</Text>
            <TextInput
              style={styles.search}
              placeholder="Search currency"
              value={query}
              onChangeText={setQuery}
            />
            <FlatList
              data={list}
              keyExtractor={(currency) => currency.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, item.code === value && styles.rowActive]}
                  onPress={() => { onChange(item.code); setVisible(false); }}
                >
                  <Text style={styles.code}>{item.code}</Text>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: 2 },
  trigger: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: { fontSize: FontSize.md, color: Colors.textPrimary },
  arrow: { fontSize: FontSize.md, color: Colors.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '85%' },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  search: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, color: Colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowActive: { backgroundColor: Colors.surfaceAlt },
  code: { width: 48, fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  name: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  closeBtn: { marginTop: Spacing.sm, backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  closeText: { color: Colors.textSecondary, fontWeight: '600' },
});
