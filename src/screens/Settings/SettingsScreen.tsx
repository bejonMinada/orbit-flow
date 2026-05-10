import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, FontSize, Labels, SyncConstants } from '../../constants';
import { CURRENCIES } from '../../data/currencies';
import { useThemeMode } from '../../theme/ThemeContext';
import CurrencyDropdown from '../../components/CurrencyDropdown';
import { getWorkspaceBaseCurrency, updateWorkspaceBaseCurrency } from '../../repositories/workspaceRepository';
import { resetAllData } from '../../db/database';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [baseCurrency, setBaseCurrency] = useState('PHP');
  const { mode, toggleMode } = useThemeMode();
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetting, setResetting] = useState(false);
  const isDark = mode === 'dark';

  const load = useCallback(async () => {
    const currency = await getWorkspaceBaseCurrency();
    setBaseCurrency(currency);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleBaseCurrencyChange = async (currency: string) => {
    const next = await updateWorkspaceBaseCurrency(currency);
    setBaseCurrency(next);
  };

  const askReset = () => {
    Alert.alert(
      'Reset all data',
      'This will permanently delete all ledgers, entries, inventories, shopping lists, settlements, and settings data on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => setResetModalVisible(true) },
      ]
    );
  };

  const confirmReset = async () => {
    if (resetInput.trim() !== 'RESET ALL') {
      Alert.alert('Confirmation required', 'Please type RESET ALL exactly to continue.');
      return;
    }
    try {
      setResetting(true);
      await resetAllData();
      await load();
      setResetInput('');
      setResetModalVisible(false);
      Alert.alert('Data reset complete', 'All local data has been reset.');
    } catch (error) {
      Alert.alert('Reset failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, isDark && { backgroundColor: '#12161D' }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <View style={styles.dropdownWrap}>
          <CurrencyDropdown value={baseCurrency} onChange={handleBaseCurrencyChange} label="Base Currency" popularOnly />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch value={mode === 'dark'} onValueChange={toggleMode} trackColor={{ true: Colors.primary, false: Colors.border }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data & Sync</Text>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Export', `Export to ${SyncConstants.cloudDataFilename} is coming in Phase 2.`)}>
          <Text style={styles.rowLabel}>Export Data</Text>
          <Text style={styles.rowArrow}>{'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Import', `Import from ${SyncConstants.cloudDataFilename} is coming in Phase 2.`)}>
          <Text style={styles.rowLabel}>Import Data</Text>
          <Text style={styles.rowArrow}>{'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Google Drive', 'Google Drive sync coming in Phase 2.')}>
          <Text style={styles.rowLabel}>Google Drive Sync</Text>
          <Text style={styles.rowValue}>Phase 2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('OneDrive', 'OneDrive sync coming in Phase 2.')}>
          <Text style={styles.rowLabel}>OneDrive Sync</Text>
          <Text style={styles.rowValue}>Phase 2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={askReset}>
          <Text style={[styles.rowLabel, { color: Colors.danger }]}>Reset All Data</Text>
          <Text style={[styles.rowValue, { color: Colors.danger }]}>Danger</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        {[
          { label: 'Receipt OCR Autofill', phase: 'Phase 4' },
          { label: 'Goal-Based Sinking Funds', phase: 'Phase 3' },
          { label: 'Burn-Rate Forecasting', phase: 'Phase 4' },
          { label: 'Biometric Lock', phase: 'Phase 3' },
          { label: Labels.sharedPools, phase: 'Phase 2' },
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

      <Modal visible={resetModalVisible} transparent animationType="fade" onRequestClose={() => setResetModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Final confirmation</Text>
            <Text style={styles.modalText}>
              Type <Text style={styles.modalStrong}>RESET ALL</Text> to confirm permanent deletion of all local data.
            </Text>
            <TextInput
              style={styles.input}
              value={resetInput}
              onChangeText={setResetInput}
              autoCapitalize="characters"
              placeholder="RESET ALL"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setResetModalVisible(false); setResetInput(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetBtn} onPress={confirmReset} disabled={resetting}>
                <Text style={styles.resetText}>{resetting ? 'Resetting...' : 'Reset Data'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  dropdownWrap: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
  modalCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalText: { marginTop: Spacing.xs, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  modalStrong: { fontWeight: '700', color: Colors.danger },
  input: { marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md, backgroundColor: Colors.surfaceAlt },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: { flex: 1, minHeight: 46, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  resetBtn: { flex: 1, minHeight: 46, borderRadius: Radius.md, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: '#fff', fontWeight: '700' },
});
