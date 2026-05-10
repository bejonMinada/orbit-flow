import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, FontSize, Labels, SyncConstants } from '../../constants';
import { CURRENCIES } from '../../data/currencies';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [baseCurrency, setBaseCurrency] = useState('PHP');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const popularCurrencies = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'INR', 'MYR', 'IDR'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <TouchableOpacity style={styles.row} onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}>
          <Text style={styles.rowLabel}>Base Currency</Text>
          <Text style={styles.rowValue}>{baseCurrency} ▾</Text>
        </TouchableOpacity>
        {showCurrencyPicker && (
          <View style={styles.currencyGrid}>
            {popularCurrencies.map((code) => (
              <TouchableOpacity
                key={code}
                style={[styles.currencyChip, baseCurrency === code && styles.currencyChipActive]}
                onPress={() => { setBaseCurrency(code); setShowCurrencyPicker(false); }}
              >
                <Text style={[styles.currencyChipText, baseCurrency === code && { color: '#fff' }]}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data & Sync</Text>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Export', `Export to ${SyncConstants.cloudDataFilename} is coming in Phase 2.`)}>
          <Text style={styles.rowLabel}>Export Data</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Import', `Import from ${SyncConstants.cloudDataFilename} is coming in Phase 2.`)}>
          <Text style={styles.rowLabel}>Import Data</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Google Drive', 'Google Drive sync coming in Phase 2.')}>
          <Text style={styles.rowLabel}>Google Drive Sync</Text>
          <Text style={styles.rowValue}>Phase 2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('OneDrive', 'OneDrive sync coming in Phase 2.')}>
          <Text style={styles.rowLabel}>OneDrive Sync</Text>
          <Text style={styles.rowValue}>Phase 2</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        {[
          { label: 'Receipt OCR Autofill', phase: 'Phase 4' },
          { label: 'Goal-Based Sinking Funds', phase: 'Phase 3' },
          { label: 'Burn-Rate Forecasting', phase: 'Phase 4' },
          { label: 'Biometric Lock', phase: 'Phase 3' },
          { label: 'Group Contributions (RBAC)', phase: 'Phase 2' },
        ].map((f) => (
          <View key={f.label} style={styles.row}>
            <Text style={styles.rowLabel}>{f.label}</Text>
            <Text style={styles.rowValue}>{f.phase}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App Name</Text>
          <Text style={styles.rowValue}>{Labels.appName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>1.0.0 (Phase 1 MVP)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Schema Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Currencies</Text>
          <Text style={styles.rowValue}>{CURRENCIES.length} supported</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize.xxxl, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.md },
  section: { backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: Spacing.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  rowLabel: { fontSize: FontSize.md, color: Colors.textPrimary },
  rowValue: { fontSize: FontSize.sm, color: Colors.textSecondary },
  rowArrow: { fontSize: FontSize.lg, color: Colors.textMuted },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, padding: Spacing.md },
  currencyChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  currencyChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
});
