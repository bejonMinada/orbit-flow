import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Colors } from '../constants';
import HomeScreen from '../screens/Home/HomeScreen';
import LedgersNavigator from './LedgersNavigator';
import ItemizedNavigator from './ItemizedNavigator';
import LendingScreen from '../screens/Lending/LendingScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';

const Tab = createBottomTabNavigator();

const icon = (emoji: string) => () => <Text style={{ fontSize: 22 }}>{emoji}</Text>;

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: icon('🏠') }} />
      <Tab.Screen name="Ledgers" component={LedgersNavigator} options={{ tabBarIcon: icon('💳') }} />
      <Tab.Screen name="Itemized" component={ItemizedNavigator} options={{ tabBarIcon: icon('📦') }} />
      <Tab.Screen name="Lending" component={LendingScreen} options={{ tabBarIcon: icon('🤝'), tabBarLabel: 'Lending' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: icon('⚙️') }} />
    </Tab.Navigator>
  );
}
