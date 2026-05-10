import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius, FontSize } from '../../constants';
import {
  getTrackedItems,
  createTrackedItem,
  updateTrackedItemQuantity,
  updateTrackedItemDetails,
  deleteTrackedItem,
  getShoppingSessions,
  createShoppingSession,
  getShoppingSessionItems,
  updateShoppingSessionItem,
  updateShoppingSessionItemDetails,
  deleteShoppingSessionItem,
  deleteShoppingSession,
} from '../../repositories/itemRepository';
import {
  TrackedItem, ShoppingSession, ShoppingSessionItem,
} from '../../types';
import { ItemizedStackParamList } from '../../navigation/ItemizedNavigator';
import { formatAmount } from '../../data/currencies';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import { getWorkspaceBaseCurrency } from '../../repositories/workspaceRepository';
import CurrencyDropdown from '../../components/CurrencyDropdown';
import { useThemeMode } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<ItemizedStackParamList, 'ItemTrackerDetail'>;
const MIN_LIST_BOTTOM_PADDING = 120;
const FAB_CLEARANCE = 92;
const FAB_SIZE = 56;

export default function ItemTrackerDetailScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { trackerId } = route.params;
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [sessions, setSessions] = useState<ShoppingSession[]>([]);
  const [sessionItemsBySession, setSessionItemsBySession] = useState<Record<string, ShoppingSessionItem[]>>({});
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [revealedSessionItemId, setRevealedSessionItemId] = useState<string | null>(null);
  const [revealedSessionDeleteId, setRevealedSessionDeleteId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('PHP');
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerMode, setScannerMode] = useState<'register' | 'search' | 'alternative' | null>(null);
  const [savedListsVisible, setSavedListsVisible] = useState(false);
  const [altPromptVisible, setAltPromptVisible] = useState(false);
  const [pendingOutOfStockItem, setPendingOutOfStockItem] = useState<ShoppingSessionItem | null>(null);
  const [alternativeName, setAlternativeName] = useState('');
  const [alternativeUnit, setAlternativeUnit] = useState('pcs');
  const [alternativeQuantity, setAlternativeQuantity] = useState('1');
  const [alternativePrice, setAlternativePrice] = useState('0');
  const [alternativeBarcode, setAlternativeBarcode] = useState('');
  const [editItemVisible, setEditItemVisible] = useState(false);
  const [editSessionItem, setEditSessionItem] = useState<ShoppingSessionItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemUnit, setEditItemUnit] = useState('pcs');
  const [editItemQuantity, setEditItemQuantity] = useState('1');
  const [editTrackedVisible, setEditTrackedVisible] = useState(false);
  const [trackedItemToEdit, setTrackedItemToEdit] = useState<TrackedItem | null>(null);
  const [trackedEditName, setTrackedEditName] = useState('');
  const [trackedEditUnit, setTrackedEditUnit] = useState('pcs');
  const [trackedEditQuantity, setTrackedEditQuantity] = useState('1');
  const [trackedEditPrice, setTrackedEditPrice] = useState('0');
  const [trackedEditBarcode, setTrackedEditBarcode] = useState('');
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const darkSurface = '#1F252F';
  const darkSurfaceAlt = '#2A3240';
  const darkBorder = '#334155';
  const darkText = '#E6E9EE';
  const darkMuted = '#B8C2D1';

  const load = useCallback(async () => {
    const [its, history, workspaceCurrency] = await Promise.all([
      getTrackedItems(trackerId),
      getShoppingSessions(trackerId),
      getWorkspaceBaseCurrency(),
    ]);
    setItems(its);
    setSessions(history);
    setCurrency(workspaceCurrency);
    const allSessionItems = await Promise.all(history.map(async (session) => [session.id, await getShoppingSessionItems(session.id)] as const));
    const bySession = Object.fromEntries(allSessionItems);
    setSessionItemsBySession(bySession);
  }, [trackerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await createTrackedItem(
        trackerId, name.trim(), unit, parseFloat(quantity) || 0,
        parseFloat(price) || 0, currency, barcode.trim() || undefined
      );
      setName('');
      setUnit('pcs');
      setQuantity('1');
      setPrice('0');
      setBarcode('');
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

  const generateChecklist = async () => {
    if (items.length === 0) {
      Alert.alert('No items yet', 'Add items first before generating a checklist.');
      return;
    }
    const session = await createShoppingSession(trackerId, `${route.params.trackerName} • ${new Date().toISOString().slice(0, 10)}`);
    setExpandedSessionId(session.id);
    await load();
  };

  const markPurchased = async (sessionItem: ShoppingSessionItem) => {
    await updateShoppingSessionItem(sessionItem.id, 'purchased');
    await load();
  };

  const markOutOfStock = (sessionItem: ShoppingSessionItem) => {
    setPendingOutOfStockItem(sessionItem);
    setAlternativeName('');
    setAlternativeUnit(sessionItem.unit || 'pcs');
    setAlternativeQuantity(String(sessionItem.plannedQuantity || 1));
    setAlternativePrice('0');
    setAlternativeBarcode('');
    setAltPromptVisible(true);
  };

  const applyOutOfStock = async () => {
    if (!pendingOutOfStockItem) return;
    const altName = alternativeName.trim();
    await updateShoppingSessionItem(pendingOutOfStockItem.id, 'out_of_stock', altName || undefined);
    if (altName) {
      const parsedAltQty = Math.max(0, parseFloat(alternativeQuantity) || 0);
      const parsedAltPrice = Math.max(0, parseFloat(alternativePrice) || 0);
      const duplicate = items.find((item) => item.name.trim().toLowerCase() === altName.toLowerCase());
      if (duplicate) {
        Alert.alert('Duplicate item', `"${altName}" already exists in inventory. Add to that existing item?`, [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: async () => {
              await updateTrackedItemQuantity(duplicate.id, duplicate.quantity + parsedAltQty);
              await load();
            },
          },
        ]);
      } else {
        await createTrackedItem(
          trackerId,
          altName,
          alternativeUnit || pendingOutOfStockItem.unit,
          parsedAltQty,
          parsedAltPrice,
          currency,
          alternativeBarcode.trim() || undefined
        );
      }
    }
    setAltPromptVisible(false);
    setPendingOutOfStockItem(null);
    await load();
  };

  const openEditSavedItem = (sessionItem: ShoppingSessionItem) => {
    setEditSessionItem(sessionItem);
    setEditItemName(sessionItem.itemName);
    setEditItemUnit(sessionItem.unit || 'pcs');
    setEditItemQuantity(String(sessionItem.plannedQuantity || 0));
    setEditItemVisible(true);
  };

  const saveEditedSavedItem = async () => {
    if (!editSessionItem) return;
    await updateShoppingSessionItemDetails(editSessionItem.id, {
      itemName: editItemName.trim() || editSessionItem.itemName,
      unit: editItemUnit.trim() || 'pcs',
      plannedQuantity: Math.max(0, parseFloat(editItemQuantity) || 0),
      alternativeItemName: editSessionItem.alternativeItemName,
    });
    setEditItemVisible(false);
    setEditSessionItem(null);
    await load();
  };

  const confirmDeleteSavedItem = (sessionItem: ShoppingSessionItem) => {
    Alert.alert('Delete item', `Remove "${sessionItem.itemName}" from this saved list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteShoppingSessionItem(sessionItem.id);
          await load();
        },
      },
    ]);
  };

  const confirmDeleteSavedList = (session: ShoppingSession) => {
    Alert.alert('Delete saved list', `Delete "${session.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteShoppingSession(session.id);
          if (expandedSessionId === session.id) setExpandedSessionId(null);
          await load();
        },
      },
    ]);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = normalizedSearch
    ? items.filter((item) => item.name.toLowerCase().includes(normalizedSearch)
      || item.barcode?.toLowerCase().includes(normalizedSearch))
    : items;
  const pinnedChecklistStyle = useMemo(
    () => ({
      bottom: insets.bottom + Spacing.lg,
      left: Spacing.md,
      right: Spacing.lg + FAB_SIZE + Spacing.sm,
    }),
    [insets.bottom]
  );

  const getItemPriceLabel = (item: TrackedItem) => {
    const latestPriceRecord = item.priceHistory[item.priceHistory.length - 1];
    return formatAmount(latestPriceRecord?.price ?? item.lastPrice, latestPriceRecord?.currency ?? currency);
  };

  const isSessionComplete = (sessionId: string) => {
    const list = sessionItemsBySession[sessionId] ?? [];
    return list.length > 0 && list.every((entry) => entry.status !== 'pending');
  };
  const getSessionProgress = (sessionId: string) => {
    const list = sessionItemsBySession[sessionId] ?? [];
    return {
      purchased: list.filter((entry) => entry.status === 'purchased').length,
      outOfStock: list.filter((entry) => entry.status === 'out_of_stock').length,
    };
  };
  const sessionTotals = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item] as const));
    const itemByName = new Map(items.map((item) => [item.name.trim().toLowerCase(), item] as const));
    const totals: Record<string, number> = {};
    for (const session of sessions) {
      const list = sessionItemsBySession[session.id] ?? [];
      totals[session.id] = list.reduce((sum, sessionItem) => {
        const tracked = sessionItem.trackedItemId
          ? itemById.get(sessionItem.trackedItemId)
          : itemByName.get(sessionItem.itemName.trim().toLowerCase());
        if (!tracked) return sum;
        return sum + ((sessionItem.plannedQuantity || 0) * (tracked.lastPrice || 0));
      }, 0);
    }
    return totals;
  }, [sessions, sessionItemsBySession, items]);

  const openTrackedItemEditor = (item: TrackedItem) => {
    setTrackedItemToEdit(item);
    setTrackedEditName(item.name);
    setTrackedEditUnit(item.unit);
    setTrackedEditQuantity(String(item.quantity));
    setTrackedEditPrice(String(item.lastPrice));
    setTrackedEditBarcode(item.barcode ?? '');
    setEditTrackedVisible(true);
  };

  const saveTrackedItemEdit = async () => {
    if (!trackedItemToEdit) return;
    await updateTrackedItemDetails(trackedItemToEdit.id, {
      name: trackedEditName.trim() || trackedItemToEdit.name,
      unit: trackedEditUnit.trim() || 'pcs',
      quantity: Math.max(0, parseFloat(trackedEditQuantity) || 0),
      price: Math.max(0, parseFloat(trackedEditPrice) || 0),
      currency,
      barcode: trackedEditBarcode.trim() || undefined,
    });
    setEditTrackedVisible(false);
    setTrackedItemToEdit(null);
    await load();
  };

  const confirmDeleteTrackedItem = (item: TrackedItem) => {
    Alert.alert('Delete item', `Delete "${item.name}" from inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrackedItem(item.id);
          await load();
        },
      },
    ]);
  };

  const openTrackedItemActions = (item: TrackedItem) => {
    Alert.alert(item.name, 'Choose an action', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openTrackedItemEditor(item) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteTrackedItem(item) },
    ]);
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#12161D' }]}>
      <View style={styles.searchBar}>
        <TextInput
          style={[styles.searchInput, isDark && { backgroundColor: darkSurface, borderColor: darkBorder, color: darkText }]}
          placeholder="Search by name, barcode, or QR code"
          placeholderTextColor={isDark ? darkMuted : undefined}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.scanBtn} onPress={() => setScannerMode('search')}>
          <Text style={styles.scanBtnText}>Scan</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(MIN_LIST_BOTTOM_PADDING, insets.bottom + FAB_CLEARANCE) }]}
        ListEmptyComponent={<Text style={styles.empty}>{items.length === 0 ? 'No items yet. Tap + to add one.' : 'No items matched your search.'}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, isDark && { backgroundColor: darkSurface }]} onLongPress={() => openTrackedItemActions(item)} activeOpacity={0.9}>
            <View style={styles.cardLeft}>
              <Text style={[styles.itemName, isDark && { color: darkText }]}>{item.name}</Text>
              <Text style={[styles.itemPrice, isDark && { color: darkMuted }]}>
                {getItemPriceLabel(item)} / {item.unit}
              </Text>
              {item.barcode ? <Text style={[styles.itemBarcode, isDark && { color: darkMuted }]}>Code: {item.barcode}</Text> : null}
            </View>
            <View style={styles.qtyControl}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(item, -1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.qty, isDark && { color: darkText }]}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(item, 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={[styles.pinnedChecklistSection, isDark && { backgroundColor: darkSurface }, pinnedChecklistStyle]}>
        <Text style={[styles.checklistTitle, isDark && { color: darkText }]}>
          Shopping List {sessions.length > 0 ? `(${sessions.length})` : ''}
        </Text>
        <View style={styles.checklistActions}>
          <TouchableOpacity style={styles.generateBtn} onPress={generateChecklist}>
            <Text style={styles.generateBtnText}>Generate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.savedBtn, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder }]} onPress={() => setSavedListsVisible(true)}>
            <Text style={[styles.savedBtnText, isDark && { color: darkText }]}>Saved</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + Spacing.lg }]} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Add Tracked Item</Text>
            {[
              { label: 'Name', value: name, onChange: setName, placeholder: 'Item name' },
              { label: 'Unit', value: unit, onChange: setUnit, placeholder: 'pcs / kg / L ...' },
              { label: 'Quantity', value: quantity, onChange: setQuantity, placeholder: '1', keyboard: 'decimal-pad' as const },
              { label: 'Price', value: price, onChange: setPrice, placeholder: '0.00', keyboard: 'decimal-pad' as const },
            ].map((field) => (
              <View key={field.label}>
                <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>{field.label}</Text>
                <TextInput
                  style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
                  placeholder={field.placeholder}
                  placeholderTextColor={isDark ? darkMuted : undefined}
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType={field.keyboard}
                />
              </View>
            ))}
            <CurrencyDropdown value={currency} onChange={setCurrency} label="Currency" />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Barcode or QR code (optional)</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
                placeholder="1234567890"
                placeholderTextColor={isDark ? darkMuted : undefined}
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

      <Modal visible={altPromptVisible} transparent animationType="fade" onRequestClose={() => setAltPromptVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.altModal, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Out of Stock</Text>
            <Text style={[styles.checkItemMeta, isDark && { color: darkMuted }]}>Add an alternative item (optional):</Text>
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Name</Text>
            <TextInput
              style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
              placeholder="Alternative item"
              placeholderTextColor={isDark ? darkMuted : undefined}
              value={alternativeName}
              onChangeText={setAlternativeName}
            />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Unit</Text>
            <TextInput
              style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
              placeholder="pcs / kg / L ..."
              placeholderTextColor={isDark ? darkMuted : undefined}
              value={alternativeUnit}
              onChangeText={setAlternativeUnit}
            />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Quantity</Text>
            <TextInput
              style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
              placeholder="1"
              placeholderTextColor={isDark ? darkMuted : undefined}
              value={alternativeQuantity}
              onChangeText={setAlternativeQuantity}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Price</Text>
            <TextInput
              style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
              placeholder="0.00"
              placeholderTextColor={isDark ? darkMuted : undefined}
              value={alternativePrice}
              onChangeText={setAlternativePrice}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Barcode or QR code (optional)</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]}
                placeholder="1234567890"
                placeholderTextColor={isDark ? darkMuted : undefined}
                value={alternativeBarcode}
                onChangeText={setAlternativeBarcode}
              />
              <TouchableOpacity style={styles.scanBtn} onPress={() => setScannerMode('alternative')}>
                <Text style={styles.scanBtnText}>Scan</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAltPromptVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={applyOutOfStock}>
                <Text style={styles.createText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={savedListsVisible} animationType="slide" onRequestClose={() => setSavedListsVisible(false)}>
        <View style={[styles.savedListsPage, isDark && { backgroundColor: '#12161D' }, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.savedHeaderRow}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Saved Lists</Text>
            <TouchableOpacity style={[styles.savedCloseBtn, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]} onPress={() => setSavedListsVisible(false)}>
              <Text style={[styles.savedCloseBtnText, isDark && { color: darkText }]}>Close</Text>
            </TouchableOpacity>
          </View>
          {sessions.length === 0 ? (
            <Text style={styles.emptyMini}>No checklist history yet.</Text>
          ) : (
            <ScrollView style={styles.savedListsScroll} contentContainerStyle={[styles.savedListsContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
              {sessions.map((session) => {
                const completed = isSessionComplete(session.id);
                const expanded = expandedSessionId === session.id;
                const sessionList = sessionItemsBySession[session.id] ?? [];
                const { purchased, outOfStock } = getSessionProgress(session.id);
                return (
                  <View key={session.id} style={styles.savedSessionBlock}>
                    <View style={styles.savedListGroup}>
                      <TouchableOpacity
                        style={[
                          styles.savedListRow,
                          completed ? styles.savedListRowComplete : styles.savedListRowPending,
                          isDark && { borderColor: darkBorder },
                          expanded && styles.savedListRowActive,
                          isDark && completed && { backgroundColor: darkSurfaceAlt },
                          isDark && !completed && { backgroundColor: '#173A31' },
                        ]}
                        onPress={() => {
                          setExpandedSessionId((prev) => (prev === session.id ? null : session.id));
                          setRevealedSessionItemId(null);
                          setRevealedSessionDeleteId(null);
                        }}
                        onLongPress={() => setRevealedSessionDeleteId((prev) => (prev === session.id ? null : session.id))}
                      >
                        <Text style={[styles.savedListRowText, isDark && { color: darkText }]}>{session.title}</Text>
                        <Text style={[styles.savedListRowMeta, isDark && { color: darkMuted }]}>{completed ? 'Completed' : 'In progress'}</Text>
                        <Text style={[styles.savedListRowMeta, isDark && { color: darkMuted }]}>Total: {formatAmount(sessionTotals[session.id] ?? 0, currency)}</Text>
                      </TouchableOpacity>
                      {revealedSessionDeleteId === session.id ? (
                        <TouchableOpacity style={[styles.savedDeleteBtn, isDark && { backgroundColor: '#4B1E1E' }]} onPress={() => confirmDeleteSavedList(session)}>
                          <Text style={styles.savedDeleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {expanded ? (
                      <View style={[styles.checklistCard, isDark && { backgroundColor: darkSurface }]}>
                        <Text style={styles.checklistMeta}>
                          {session.title} · {purchased} bought · {outOfStock} out of stock
                        </Text>
                        {sessionList.length === 0 ? (
                          <Text style={styles.emptyMini}>No items in this checklist.</Text>
                        ) : (
                          sessionList.map((sessionItem) => (
                            <TouchableOpacity
                              key={sessionItem.id}
                              style={[styles.checkItemRow, isDark && { borderTopColor: darkBorder }]}
                              activeOpacity={0.9}
                              onLongPress={() => setRevealedSessionItemId((prev) => (prev === sessionItem.id ? null : sessionItem.id))}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.checkItemName, isDark && { color: darkText }]}>{sessionItem.itemName}</Text>
                                <Text style={[styles.checkItemMeta, isDark && { color: darkMuted }]}>
                                  {sessionItem.plannedQuantity} {sessionItem.unit} · {sessionItem.status.replace('_', ' ')}
                                </Text>
                                {sessionItem.alternativeItemName ? (
                                  <Text style={styles.altText}>Alternative: {sessionItem.alternativeItemName}</Text>
                                ) : null}
                              </View>
                              <View style={styles.checkActions}>
                                <TouchableOpacity style={styles.buyBtn} onPress={() => markPurchased(sessionItem)}>
                                  <Text style={styles.buyBtnText}>Bought</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.outBtn} onPress={() => markOutOfStock(sessionItem)}>
                                  <Text style={styles.outBtnText}>Out</Text>
                                </TouchableOpacity>
                                {revealedSessionItemId === sessionItem.id ? (
                                  <>
                                    <TouchableOpacity style={styles.editTinyBtn} onPress={() => openEditSavedItem(sessionItem)}>
                                      <Text style={styles.editTinyBtnText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.deleteTinyBtn} onPress={() => confirmDeleteSavedItem(sessionItem)}>
                                      <Text style={styles.deleteTinyBtnText}>Delete</Text>
                                    </TouchableOpacity>
                                  </>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal visible={editTrackedVisible} transparent animationType="fade" onRequestClose={() => setEditTrackedVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.altModal, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Edit Inventory Item</Text>
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Name</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={trackedEditName} onChangeText={setTrackedEditName} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Unit</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={trackedEditUnit} onChangeText={setTrackedEditUnit} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Quantity</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={trackedEditQuantity} onChangeText={setTrackedEditQuantity} keyboardType="decimal-pad" />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Price</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={trackedEditPrice} onChangeText={setTrackedEditPrice} keyboardType="decimal-pad" />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Barcode</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={trackedEditBarcode} onChangeText={setTrackedEditBarcode} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditTrackedVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={saveTrackedItemEdit}>
                <Text style={styles.createText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editItemVisible} transparent animationType="fade" onRequestClose={() => setEditItemVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.altModal, isDark && { backgroundColor: darkSurface }]}>
            <Text style={[styles.modalTitle, isDark && { color: darkText }]}>Edit Saved List Item</Text>
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Name</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editItemName} onChangeText={setEditItemName} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Unit</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editItemUnit} onChangeText={setEditItemUnit} />
            <Text style={[styles.fieldLabel, isDark && { color: darkMuted }]}>Quantity</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, color: darkText }]} value={editItemQuantity} onChangeText={setEditItemQuantity} keyboardType="decimal-pad" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditItemVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={saveEditedSavedItem}>
                <Text style={styles.createText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={scannerMode !== null}
        title={scannerMode === 'register' ? 'Scan item barcode' : scannerMode === 'alternative' ? 'Scan alternative item' : 'Search item'}
        subtitle={
          scannerMode === 'register'
            ? 'Scan a barcode or QR code to fill the item code.'
            : scannerMode === 'alternative'
              ? 'Scan a barcode or QR code for the alternative item.'
              : 'Scan a barcode or QR code to search this tracker.'
        }
        onClose={() => setScannerMode(null)}
        onScanned={(value) => {
          if (scannerMode === 'register') {
            setBarcode(value);
          } else if (scannerMode === 'alternative') {
            setAlternativeBarcode(value);
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
  checklistHeader: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm, marginTop: Spacing.xs },
  checklistActions: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center', alignItems: 'center' },
  pinnedChecklistSection: {
    position: 'absolute',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    height: FAB_SIZE,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  checklistTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginRight: Spacing.xs },
  generateBtn: { minHeight: 34, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
  generateBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  savedBtn: { minHeight: 34, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  savedBtnText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  checklistCard: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm },
  checklistMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  checkItemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  checkItemName: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  checkItemMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  altText: { fontSize: FontSize.xs, color: Colors.warning, marginTop: 2 },
  checkActions: { flexDirection: 'row', gap: 6 },
  buyBtn: { backgroundColor: Colors.cashIn, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 6 },
  buyBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  outBtn: { backgroundColor: Colors.warning, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 6 },
  outBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  editTinyBtn: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  editTinyBtnText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  deleteTinyBtn: { backgroundColor: '#FEE2E2', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 6 },
  deleteTinyBtnText: { color: Colors.danger, fontSize: FontSize.xs, fontWeight: '700' },
  emptyMini: { color: Colors.textMuted, fontSize: FontSize.xs, marginHorizontal: Spacing.md, marginTop: Spacing.xs, fontStyle: 'italic', textAlign: 'center' },
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
  savedListsPage: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.md },
  savedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  savedCloseBtn: { minHeight: 40, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  savedCloseBtnText: { color: Colors.textSecondary, fontWeight: '700' },
  savedListsScroll: { flex: 1, marginTop: Spacing.xs },
  savedListsContent: { paddingBottom: Spacing.md, paddingTop: Spacing.sm },
  savedSessionBlock: { marginBottom: Spacing.md },
  savedListGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  savedListRow: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  savedListRowPending: { backgroundColor: '#E8F8F1', borderColor: Colors.primary },
  savedListRowComplete: { backgroundColor: '#E5E7EB', borderColor: '#CBD5E1' },
  savedListRowActive: { borderColor: Colors.primaryDark, borderWidth: 2 },
  savedListRowText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  savedListRowMeta: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  savedDeleteBtn: { backgroundColor: '#FEE2E2', borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  savedDeleteBtnText: { color: Colors.danger, fontWeight: '700', fontSize: FontSize.xs },
  altModal: { backgroundColor: Colors.surface, margin: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: 2 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.surface,
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
