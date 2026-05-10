import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import ItemizedListScreen from '../screens/Itemized/ItemizedListScreen';
import ItemTrackerDetailScreen from '../screens/Itemized/ItemTrackerDetailScreen';

export type ItemizedStackParamList = {
  ItemizedList: undefined;
  ItemTrackerDetail: { trackerId: string; trackerName: string };
};

const Stack = createNativeStackNavigator<ItemizedStackParamList>();

export default function ItemizedNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="ItemizedList" component={ItemizedListScreen} options={{ title: 'Itemized Inventories' }} />
      <Stack.Screen name="ItemTrackerDetail" component={ItemTrackerDetailScreen} options={({ route }) => ({ title: route.params.trackerName })} />
    </Stack.Navigator>
  );
}
