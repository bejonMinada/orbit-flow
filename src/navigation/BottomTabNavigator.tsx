import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMeta, Colors } from '../constants';
import HomeScreen from '../screens/Home/HomeScreen';
import LedgersNavigator from './LedgersNavigator';
import ItemizedNavigator from './ItemizedNavigator';
import LendingScreen from '../screens/Lending/LendingScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import { useThemeMode } from '../theme/ThemeContext';

export type RootTabParamList = {
  Dashboard: undefined;
  Ledgers: undefined;
  Itemized: undefined;
  Lending: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const APP_VERSION = `v${AppMeta.version}`;
const TAB_LABEL_BOTTOM_PADDING = 33;

export default function BottomTabNavigator() {
  const { mode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const isDark = mode === 'dark';
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: isDark ? '#94A3B8' : Colors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? '#12161D' : Colors.surface,
          borderTopColor: isDark ? '#253041' : Colors.border,
          height: 92 + insets.bottom,
          paddingBottom: Math.max(insets.bottom + 10, 20),
          paddingTop: 0,
        },
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarItemStyle: { justifyContent: 'flex-start', paddingTop: 4, paddingBottom: TAB_LABEL_BOTTOM_PADDING },
        tabBarShowLabel: true,
        tabBarIcon: () => null,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <Text style={[styles.versionText, { color: isDark ? '#94A3B8' : Colors.textMuted, bottom: Math.max(insets.bottom - 2, 3) }]}>
              {APP_VERSION}
            </Text>
          </View>
        ),
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={HomeScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Ledgers" component={LedgersNavigator} options={{ tabBarLabel: 'Cash Ledgers' }} />
      <Tab.Screen name="Itemized" component={ItemizedNavigator} options={{ tabBarLabel: 'Inventories' }} />
      <Tab.Screen name="Lending" component={LendingScreen} options={{ tabBarLabel: 'Settlement Hub' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  versionText: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '600',
  },
});
