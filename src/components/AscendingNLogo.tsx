import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants';

interface Props {
  size?: number;
  subtle?: boolean;
}

export default function AscendingNLogo({ size = 36, subtle = false }: Props) {
  const barWidth = size / 5;
  const gap = size / 12;
  return (
    <View style={[styles.wrap, subtle && styles.subtle]}>
      <View style={[styles.bar, { width: barWidth, height: size * 0.45 }]} />
      <View style={[styles.bar, { width: barWidth, height: size * 0.7, marginLeft: gap }]} />
      <View style={[styles.bar, { width: barWidth, height: size, marginLeft: gap }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end' },
  subtle: { opacity: 0.5 },
  bar: { borderRadius: 999, backgroundColor: Colors.primary },
});
