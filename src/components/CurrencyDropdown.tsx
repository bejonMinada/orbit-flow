import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, TextInput,
} from 'react-native';
import { CURRENCIES } from '../data/currencies';
import { Colors, FontSize, Radius, Spacing } from '../constants';
import { useThemeMode } from '../theme/ThemeContext';

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
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const darkSurface = '#1F252F';
  const darkSurfaceAlt = '#2A3240';
  const darkBorder = '#334155';
  const darkText = '#E6E9EE';
  const darkMuted = '#B8C2D1';
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
      <Text style={[styles.label, isDark && { color: darkMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.trigger, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder }]} onPress={() => setVisible(true)}>
        <Text style={[styles.value, isDark && { color: darkText }]}>{value}</Text>
        <Text style={[styles.arrow, isDark && { color: darkMuted }]}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.title, isDark && { color: darkText }]}>Select Currency</Text>
            <TextInput
              style={[styles.search, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
              placeholder="Search currency"
              placeholderTextColor={isDark ? darkMuted : undefined}
              value={query}
              onChangeText={setQuery}
            />
            <FlatList
              data={list}
              keyExtractor={(currency) => currency.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, isDark && { borderBottomColor: darkBorder }, item.code === value && styles.rowActive, isDark && item.code === value && { backgroundColor: darkSurfaceAlt }]}
                  onPress={() => { onChange(item.code); setVisible(false); }}
                >
                  <Text style={[styles.code, isDark && { color: darkText }]}>{item.code}</Text>
                  <Text style={[styles.name, isDark && { color: darkMuted }]} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={[styles.closeBtn, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]} onPress={() => setVisible(false)}>
              <Text style={[styles.closeText, isDark && { color: darkText }]}>Close</Text>
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
