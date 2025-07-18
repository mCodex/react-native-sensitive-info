import { useState } from 'react';
import type { Theme } from '../types';
import { lightTheme, darkTheme } from '../styles/themes';

interface UseThemeReturn {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setDarkMode: (isDark: boolean) => void;
}

export function useTheme(initialDarkMode: boolean = false): UseThemeReturn {
  const [isDarkMode, setIsDarkMode] = useState(initialDarkMode);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const setDarkMode = (isDark: boolean) => {
    setIsDarkMode(isDark);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return {
    theme,
    isDarkMode,
    toggleTheme,
    setDarkMode,
  };
}
