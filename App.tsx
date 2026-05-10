import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDb } from './src/db/database';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import { Colors, FontSize, Labels } from './src/constants';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDb()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to initialize database:</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{Labels.appName}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <BottomTabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 24 },
  loadingText: { marginTop: 16, fontSize: FontSize.lg, color: Colors.primary, fontWeight: '600' },
  errorText: { fontSize: FontSize.md, color: Colors.danger, fontWeight: 'bold', marginBottom: 8 },
  errorDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
