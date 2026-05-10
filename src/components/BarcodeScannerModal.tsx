import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, FontSize, Radius, Spacing } from '../constants';
import { useThemeMode } from '../theme/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onScanned: (value: string) => void;
};

export default function BarcodeScannerModal({
  visible,
  title,
  subtitle,
  onClose,
  onScanned,
}: Props) {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const darkSurface = '#1F252F';
  const darkSurfaceAlt = '#2A3240';
  const darkBorder = '#334155';
  const darkText = '#E6E9EE';
  const darkMuted = '#B8C2D1';
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!visible) {
      setLocked(false);
      return;
    }

    setLocked(false);
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => undefined);
    }
  }, [permission?.canAskAgain, permission?.granted, requestPermission, visible]);

  const handleScan = useCallback((value: string) => {
    const cleanValue = value.trim();
    if (!cleanValue || locked) return;

    setLocked(true);
    onScanned(cleanValue);
    onClose();
  }, [locked, onClose, onScanned]);
  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    handleScan(data);
  }, [handleScan]);

  const hasPermission = permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, isDark && { backgroundColor: darkSurface }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, isDark && { color: darkText }]}>{title}</Text>
              <Text style={[styles.subtitle, isDark && { color: darkMuted }]}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          {hasPermission ? (
            <View style={styles.cameraWrap}>
              <CameraView
                active={visible}
                style={styles.camera}
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View style={styles.scanGuide}>
                <Text style={styles.scanGuideText}>Point the camera at a barcode or QR code.</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.permissionCard, isDark && { backgroundColor: darkSurfaceAlt, borderColor: darkBorder, borderWidth: 1 }]}>
              <Text style={[styles.permissionText, isDark && { color: darkMuted }]}>Camera access is needed to scan barcodes and QR codes.</Text>
              <TouchableOpacity style={styles.permissionBtn} onPress={() => requestPermission()}>
                <Text style={styles.permissionBtnText}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    minHeight: '72%',
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  close: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  cameraWrap: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    minHeight: 360,
  },
  scanGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.lg,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  scanGuideText: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    fontSize: FontSize.sm,
    overflow: 'hidden',
  },
  permissionCard: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  permissionText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
