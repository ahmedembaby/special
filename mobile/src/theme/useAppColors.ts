import { Colors } from './colors';
import { useThemeSettings } from '../context/ThemeContext';

/** Colors that follow the in-app Dark Mode switch (ThemeContext). */
export const useAppColors = () => {
  const { darkMode } = useThemeSettings();
  return { isDark: darkMode, c: darkMode ? Colors.dark : Colors.light };
};
