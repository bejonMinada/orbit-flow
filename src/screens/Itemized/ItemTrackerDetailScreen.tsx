import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius, FontSize } from '../../constants';
import { getTrackedItems, createTrackedItem, updateTrackedItemQuantity } from '../../repositories/itemRepository';
import { TrackedItem } from '../../types';
import { ItemizedStackParamList } from '../../navigation/ItemizedNavigator';
import { formatAmount } from '../../data/currencies';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';

type Props = NativeStackScreenProps<ItemizedStackParamList, 'ItemTrackerDetail'>;

export default function ItemTrackerDetailScreen({ route }: Props) {
  const { trackerId } = route.params;
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('PHP');
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerMode, setScannerMode] = useState<'register' | 'search' | null>(null);

  const load = useCallback(async () => {
    const its = await getTrackedItems(trackerId);
    setItems(its);
  }, [trackerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await createTrackedItem(
        trackerId, name.trim(), unit, parseFloat(quantity) || 0,
        parseFloat(price) || 0, currency, barcode.trim() || undefined
      );
      setName(''); setUnit('pcs'); setQuantity('1'); setPrice('0'); setBarcode('');
      setModalVisible(false);
      load();
    } catch (error) {
      Alert.alert('Unable to add item', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const adjustQty = (item: TrackedItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    updateTrackedItemQuantity(item.id, newQty).then(load);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = normalizedSearch
    ? items.filter((item) => item.name.toLowerCase().includes(normalizedSearch)
      || item.barcode?.toLowerCase().includes(normalizedSearch))
    : items;
  const getItemPriceLabel = (item: TrackedItem) => {
    const latestPriceRecord = item.priceHistory[item.priceHistory.length - 1];
    return formatAmount(latestPriceRecord?.price ?? item.lastPrice, latestPriceRecord?.currency ?? currency);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or barcode"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.scanBtn} onPress={() => setScannerMode('search')}>
          <Text style={styles.scanBtnText}>Scan</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{items.length === 0 ? 'No items yet. Tap + to add one.' : 'No items matched your search.'}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>
                {getItemPriceLabel(item)} / {item.unit}
              </Text>
              {item.barcode ? <Text style={styles.itemBarcode}>Code: {item.barcode}</Text> : null}
            </View>
            <View style={styles.qtyControl}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(item, -1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qty}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(item, 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Tracked Item</Text>
              {[
                { label: 'Name', value: name, onChange: setName, placeholder: 'Item name' },
                { label: 'Unit', value: unit, onChange: setUnit, placeholder: 'pcs / kg / L ...' },
                { label: 'Quantity', value: quantity, onChange: setQuantity, placeholder: '1', keyboard: 'decimal-pad' as const },
                { label: 'Price', value: price, onChange: setPrice, placeholder: '0.00', keyboard: 'decimal-pad' as const },
                { label: 'Currency', value: currency, onChange: setCurrency, placeholder: 'PHP' },
              ].map((f) => (
                <View key={f.label}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType={f.keyboard}
                  />
                </View>
              ))}
              <Text style={styles.fieldLabel}>Barcode or QR code (optional)</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, styles.barcodeInput]}
                  placeholder="1234567890"
                  value={barcode}
                  onChangeText={setBarcode}
                />
                <TouchableOpacity style={styles.scanBtn} onPress={() => setScannerMode('register')}>
                  <Text style={styles.scanBtnText}>Scan</Text>
                </TouchableOpacity>
              </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleAdd}>
                <Text style={styles.createText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={scannerMode !== null}
        title={scannerMode === 'register' ? 'Scan item barcode' : 'Search item'}
        subtitle={scannerMode === 'register' ? 'Scan a barcode or QR code to fill the item code.' : 'Scan a barcode or QR code to search this tracker.'}
        onClose={() => setScannerMode(null)}
        onScanned={(value) => {
          if (scannerMode === 'register') {
            setBarcode(value);
          } else {
            setSearchQuery(value);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  list: { padding: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  cardLeft: { flex: 1 },
  itemName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  itemPrice: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  itemBarcode: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold', lineHeight: 22 },
  qty: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary, minWidth: 30, textAlign: 'center' },
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
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary,
  },
  barcodeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  barcodeInput: { flex: 1 },
  scanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  createBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '600' },
});
