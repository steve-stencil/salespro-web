/**
 * Price Guide Toast Hook.
 * Provides toast notifications for Price Guide operations.
 */

import { useContext } from 'react';

import { ToastContext } from './PriceGuideToastContext';

import type { ToastContextValue } from './PriceGuideToastContext';

/**
 * Hook to access Price Guide toast notifications.
 * Must be used within a PriceGuideToastProvider.
 */
export function usePriceGuideToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error(
      'usePriceGuideToast must be used within a PriceGuideToastProvider',
    );
  }
  return context;
}
