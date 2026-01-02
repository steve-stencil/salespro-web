/**
 * Price Guide Toast Context Definition.
 */

import { createContext } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  message: string;
  severity: ToastSeverity;
  autoHideDuration?: number;
};

export type ToastContextValue = {
  showToast: (
    message: string,
    severity?: ToastSeverity,
    duration?: number,
  ) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
};

// ============================================================================
// Context
// ============================================================================

export const ToastContext = createContext<ToastContextValue | null>(null);
