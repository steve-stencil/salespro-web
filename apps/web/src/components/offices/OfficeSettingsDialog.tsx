/**
 * Office settings dialog component.
 * Provides interface for managing office settings including logo.
 */
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useState, useEffect, useCallback } from 'react';

import {
  useOfficeSettings,
  useUploadLogo,
  useRemoveLogo,
} from '../../hooks/useOfficeSettings';
import { handleApiError } from '../../lib/api-client';

import { OfficeLogoUpload } from './OfficeLogoUpload';

import type { Office } from '../../types/users';

type OfficeSettingsDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** The office to show settings for */
  office: Office | null;
  /** Callback when the dialog is closed */
  onClose: () => void;
  /** Callback when settings are updated */
  onUpdated?: () => void;
};

/**
 * Dialog for managing office settings including logo upload/removal.
 */
export function OfficeSettingsDialog({
  open,
  office,
  onClose,
  onUpdated,
}: OfficeSettingsDialogProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: settingsData,
    isLoading: isLoadingSettings,
    refetch: refetchSettings,
  } = useOfficeSettings(office?.id ?? null);

  const uploadLogoMutation = useUploadLogo();
  const removeLogoMutation = useRemoveLogo();

  // Clear messages when dialog opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMessage(null);
    }
  }, [open]);

  /**
   * Handle logo file selection for upload.
   */
  const handleFileSelect = useCallback(
    async (file: File): Promise<void> => {
      if (!office) return;

      setError(null);
      setSuccessMessage(null);

      try {
        await uploadLogoMutation.mutateAsync({
          officeId: office.id,
          file,
        });
        setSuccessMessage('Logo uploaded successfully');
        void refetchSettings();
        onUpdated?.();
      } catch (err) {
        setError(handleApiError(err));
      }
    },
    [office, uploadLogoMutation, refetchSettings, onUpdated],
  );

  /**
   * Handle logo removal.
   */
  const handleRemoveLogo = useCallback(async (): Promise<void> => {
    if (!office) return;

    setError(null);
    setSuccessMessage(null);

    try {
      await removeLogoMutation.mutateAsync(office.id);
      setSuccessMessage('Logo removed successfully');
      void refetchSettings();
      onUpdated?.();
    } catch (err) {
      setError(handleApiError(err));
    }
  }, [office, removeLogoMutation, refetchSettings, onUpdated]);

  const settings = settingsData?.settings;
  const isUploading = uploadLogoMutation.isPending;
  const isRemoving = removeLogoMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="office-settings-dialog-title"
    >
      <DialogTitle
        id="office-settings-dialog-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <SettingsIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="span">
            Office Settings
          </Typography>
          {office && (
            <Typography
              variant="subtitle2"
              color="text.secondary"
              component="div"
            >
              {office.name}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Success message */}
        {successMessage && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setSuccessMessage(null)}
          >
            {successMessage}
          </Alert>
        )}

        {/* Logo section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Office Logo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a logo to represent this office. The logo will be displayed
            in the office list and other areas of the application.
          </Typography>

          {isLoadingSettings ? (
            <Box>
              <Skeleton variant="rounded" width="100%" height={200} />
            </Box>
          ) : office ? (
            <OfficeLogoUpload
              logo={settings?.logo}
              officeName={office.name}
              onFileSelect={file => void handleFileSelect(file)}
              onRemove={() => void handleRemoveLogo()}
              isUploading={isUploading}
              isRemoving={isRemoving}
            />
          ) : (
            <Alert severity="info">No office selected</Alert>
          )}
        </Box>

        {/* Settings metadata */}
        {settings && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Settings last updated:{' '}
              {new Date(settings.updatedAt).toLocaleString()}
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
