import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import ItemizedListScreen from '../screens/Itemized/ItemizedListScreen';
import ItemTrackerDetailScreen from '../screens/Itemized/ItemTrackerDetailScreen';
import { useThemeMode } from '../theme/ThemeContext';

export type ItemizedStackParamList = {
  ItemizedList: undefined;
  ItemTrackerDetail: { trackerId: string; trackerName: string };
};

const Stack = createNativeStackNavigator<ItemizedStackParamList>();

export default function ItemizedNavigator() {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? '#1F252F' : Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="ItemizedList" component={ItemizedListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ItemTrackerDetail" component={ItemTrackerDetailScreen} options={({ route }) => ({ title: route.params.trackerName })} />
    </Stack.Navigator>
  );
}
