import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors } from '../constants';

interface Props {
  size?: number;
  subtle?: boolean;
}

export default function AscendingNLogo({ size = 36, subtle = false }: Props) {
  return (
    <View style={[styles.wrap, subtle && styles.subtle, { width: size, height: size }]}>
      <Text style={[styles.mark, { fontSize: size * 0.6 }]}>N</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  subtle: { opacity: 0.5 },
  mark: {
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
