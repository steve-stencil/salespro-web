/**
 * Color mode context for managing light/dark theme toggle.
 * Detects system preference by default and allows manual override.
 */

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { darkTheme, lightTheme } from './theme';

type ColorMode = 'light' | 'dark' | 'system';

interface ColorModeContextType {
  mode: ColorMode;
  actualMode: 'light' | 'dark';
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(
  undefined,
);

const STORAGE_KEY = 'leap-color-mode';

interface ColorModeProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that wraps app with theme and color mode support.
 */
export function ColorModeProvider({
  children,
}: ColorModeProviderProps): React.ReactElement {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setModeState] = useState<ColorMode>('system');

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setModeState(saved);
    }
  }, []);

  // Determine actual mode based on preference
  const actualMode: 'light' | 'dark' = useMemo(() => {
    if (mode === 'system') {
      return prefersDarkMode ? 'dark' : 'light';
    }
    return mode;
  }, [mode, prefersDarkMode]);

  // Select theme based on actual mode
  const theme = useMemo(() => {
    return actualMode === 'dark' ? darkTheme : lightTheme;
  }, [actualMode]);

  const setMode = useCallback((newMode: ColorMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => {
      const newMode =
        prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      localStorage.setItem(STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      mode,
      actualMode,
      setMode,
      toggleMode,
    }),
    [mode, actualMode, setMode, toggleMode],
  );

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

/**
 * Hook to access color mode context.
 * @throws Error if used outside ColorModeProvider
 */
export function useColorMode(): ColorModeContextType {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}
