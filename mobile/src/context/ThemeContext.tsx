import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({ darkMode: false, setDarkMode: () => {} });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [darkMode, setDarkModeState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('dark_mode')
      .then((v) => setDarkModeState(v === 'true'))
      .catch(() => {});
  }, []);

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    AsyncStorage.setItem('dark_mode', String(value)).catch(() => {});
  }, []);

  const value = useMemo(() => ({ darkMode, setDarkMode }), [darkMode, setDarkMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeSettings = (): ThemeContextType => useContext(ThemeContext);
