/**
 * Hook to access color mode context.
 * Separated from provider to support React Fast Refresh.
 */

import { useContext } from 'react';

import { ColorModeContext } from './colorModeContextDef';

import type { ColorModeContextType } from './colorModeContextDef';

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
