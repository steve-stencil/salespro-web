/**
 * Office settings dialog component.
 * Provides interface for managing office settings including logo selection from library.
 */
import BusinessIcon from '@mui/icons-material/Business';
import CloseIcon from '@mui/icons-material/Close';
import CollectionsIcon from '@mui/icons-material/Collections';
import SettingsIcon from '@mui/icons-material/Settings';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
  useSelectLogo,
  useRemoveLogo,
} from '../../hooks/useOfficeSettings';
import { handleApiError } from '../../lib/api-client';
import { LogoPickerDialog } from '../company';

import { OfficeLogo } from './OfficeLogo';

import type { CompanyLogoLibraryItem } from '../../types/company';
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
 * Dialog for managing office settings including logo selection from library.
 */
export function OfficeSettingsDialog({
  open,
  office,
  onClose,
  onUpdated,
}: OfficeSettingsDialogProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    data: settingsData,
    isLoading: isLoadingSettings,
    refetch: refetchSettings,
  } = useOfficeSettings(office?.id ?? null);

  const selectLogoMutation = useSelectLogo();
  const removeLogoMutation = useRemoveLogo();

  // Clear messages when dialog opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMessage(null);
    }
  }, [open]);

  /**
   * Handle logo selection from library.
   */
  const handleSelectLogo = useCallback(
    async (logo: CompanyLogoLibraryItem): Promise<void> => {
      if (!office) return;

      setError(null);
      setSuccessMessage(null);

      try {
        await selectLogoMutation.mutateAsync({
          officeId: office.id,
          logoId: logo.id,
        });
        setSuccessMessage(`Logo "${logo.name}" selected`);
        void refetchSettings();
        onUpdated?.();
      } catch (err) {
        setError(handleApiError(err));
      }
    },
    [office, selectLogoMutation, refetchSettings, onUpdated],
  );

  /**
   * Handle logo removal (revert to company default).
   */
  const handleResetToDefault = useCallback(async (): Promise<void> => {
    if (!office) return;

    setError(null);
    setSuccessMessage(null);

    try {
      await removeLogoMutation.mutateAsync(office.id);
      setSuccessMessage('Now using company default logo');
      void refetchSettings();
      onUpdated?.();
    } catch (err) {
      setError(handleApiError(err));
    }
  }, [office, removeLogoMutation, refetchSettings, onUpdated]);

  const settings = settingsData?.settings;
  const isSelecting = selectLogoMutation.isPending;
  const isResetting = removeLogoMutation.isPending;

  // Determine which logo to display and its source
  const displayLogo = settings?.logo ?? settings?.companyDefaultLogo;
  const logoSource = settings?.logoSource ?? 'none';

  return (
    <>
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
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setError(null)}
            >
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
              Select a logo from your company's library or use the company
              default. Offices without a specific logo will inherit the company
              default.
            </Typography>

            {isLoadingSettings ? (
              <Box>
                <Skeleton variant="rounded" width="100%" height={150} />
              </Box>
            ) : office ? (
              <Box>
                {/* Current logo display */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    mb: 2,
                  }}
                >
                  {displayLogo ? (
                    <Box
                      component="img"
                      src={displayLogo.thumbnailUrl ?? displayLogo.url}
                      alt={displayLogo.name}
                      sx={{
                        width: 64,
                        height: 64,
                        objectFit: 'contain',
                        bgcolor: 'white',
                        borderRadius: 1,
                        p: 0.5,
                      }}
                    />
                  ) : (
                    <OfficeLogo
                      logo={null}
                      officeName={office.name}
                      size={64}
                    />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">
                        {displayLogo?.name ?? 'No logo'}
                      </Typography>
                      {logoSource === 'company' && (
                        <Chip
                          label="Inherited"
                          size="small"
                          icon={<BusinessIcon sx={{ fontSize: 14 }} />}
                          variant="outlined"
                          color="default"
                        />
                      )}
                      {logoSource === 'office' && (
                        <Chip
                          label="Custom"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    {logoSource === 'company' && (
                      <Typography variant="caption" color="text.secondary">
                        Using company default logo
                      </Typography>
                    )}
                    {logoSource === 'none' && (
                      <Typography variant="caption" color="text.secondary">
                        Select a logo from the library
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={<CollectionsIcon />}
                    onClick={() => setPickerOpen(true)}
                    disabled={isSelecting || isResetting}
                  >
                    Choose from Library
                  </Button>

                  {logoSource === 'office' && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => void handleResetToDefault()}
                      disabled={isSelecting || isResetting}
                    >
                      {isResetting ? 'Resetting...' : 'Reset to Default'}
                    </Button>
                  )}
                </Box>
              </Box>
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

      {/* Logo picker dialog */}
      <LogoPickerDialog
        open={pickerOpen}
        selectedLogoId={settings?.logo?.id}
        onClose={() => setPickerOpen(false)}
        onSelect={logo => void handleSelectLogo(logo)}
        title={`Select Logo for ${office?.name ?? 'Office'}`}
      />
    </>
  );
}
