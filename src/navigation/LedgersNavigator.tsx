import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import LedgersListScreen from '../screens/Ledgers/LedgersListScreen';
import LedgerDetailScreen from '../screens/Ledgers/LedgerDetailScreen';
import AddEntryScreen from '../screens/Ledgers/AddEntryScreen';

export type LedgersStackParamList = {
  LedgersList: undefined;
  LedgerDetail: { ledgerId: string; ledgerName: string; currency: string };
  AddEntry: { ledgerId: string; currency: string };
};

const Stack = createNativeStackNavigator<LedgersStackParamList>();

export default function LedgersNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="LedgersList" component={LedgersListScreen} options={{ title: 'Cash Ledgers' }} />
      <Stack.Screen name="LedgerDetail" component={LedgerDetailScreen} options={({ route }) => ({ title: route.params.ledgerName })} />
      <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: 'Add Entry' }} />
    </Stack.Navigator>
  );
}
