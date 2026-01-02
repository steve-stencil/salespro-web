/**
 * Price Guide Toast Provider Component.
 * Provides toast notifications for Price Guide operations.
 */

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { useState, useCallback, useMemo } from 'react';

import { ToastContext } from './PriceGuideToastContext';

import type { Toast, ToastSeverity } from './PriceGuideToastContext';
import type { ReactNode } from 'react';

// ============================================================================
// Provider
// ============================================================================

type PriceGuideToastProviderProps = {
  children: ReactNode;
};

export function PriceGuideToastProvider({
  children,
}: PriceGuideToastProviderProps): React.ReactElement {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback(
    (message: string, severity: ToastSeverity = 'info', duration = 5000) => {
      setToast({
        id: Date.now().toString(),
        message,
        severity,
        autoHideDuration: duration,
      });
    },
    [],
  );

  const showSuccess = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast],
  );

  const showError = useCallback(
    (message: string) => showToast(message, 'error', 7000),
    [showToast],
  );

  const showWarning = useCallback(
    (message: string) => showToast(message, 'warning'),
    [showToast],
  );

  const showInfo = useCallback(
    (message: string) => showToast(message, 'info'),
    [showToast],
  );

  const handleClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') return;
      setToast(null);
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
    }),
    [showToast, showSuccess, showError, showWarning, showInfo],
  );

  const getIcon = (severity: ToastSeverity) => {
    switch (severity) {
      case 'success':
        return <CheckCircleIcon fontSize="inherit" />;
      case 'error':
        return <ErrorIcon fontSize="inherit" />;
      case 'warning':
        return <WarningIcon fontSize="inherit" />;
      case 'info':
        return <InfoIcon fontSize="inherit" />;
    }
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.autoHideDuration ?? 5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            icon={getIcon(toast.severity)}
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={handleClose}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{
              width: '100%',
              boxShadow: 3,
            }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}
