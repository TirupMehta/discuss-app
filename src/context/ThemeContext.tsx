import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [themeMode, setThemeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem('theme_preference')
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeState(saved);
        }
      })
      .catch((err) => console.warn("Failed to load theme preference:", err));
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      await AsyncStorage.setItem('theme_preference', mode);
    } catch (err) {
      console.warn("Failed to save theme preference:", err);
    }
  };

  const resolvedTheme = themeMode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : themeMode;

  const toggleTheme = () => {
    setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
