import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../constants';
import HomeScreen from '../screens/Home/HomeScreen';
import LedgersNavigator from './LedgersNavigator';
import ItemizedNavigator from './ItemizedNavigator';
import LendingScreen from '../screens/Lending/LendingScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';

export type RootTabParamList = {
  Dashboard: undefined;
  Ledgers: undefined;
  Itemized: undefined;
  Lending: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarShowIcon: false,
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
