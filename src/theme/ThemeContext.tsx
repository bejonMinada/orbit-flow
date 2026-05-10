import React, { createContext, useContext, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setMode] = useState<ThemeMode>(systemMode);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    setMode,
    toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider.');
  }
  return context;
}
