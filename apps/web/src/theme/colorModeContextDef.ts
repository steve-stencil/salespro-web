/**
 * Color mode context definition.
 * Separated from provider to support React Fast Refresh.
 */

import { createContext } from 'react';

type ColorMode = 'light' | 'dark' | 'system';

export type ColorModeContextType = {
  mode: ColorMode;
  actualMode: 'light' | 'dark';
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
};

export const ColorModeContext = createContext<ColorModeContextType | undefined>(
  undefined,
);
