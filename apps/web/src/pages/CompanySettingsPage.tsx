/**
 * Company settings page.
 * Allows admins to manage company-wide settings including MFA requirements and logo library.
 * Requires company:update permission to view and modify settings.
 */
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SaveIcon from '@mui/icons-material/Save';
import SecurityIcon from '@mui/icons-material/Security';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useState, useEffect, useCallback } from 'react';

import { LogoLibrarySection } from '../components/company';
import { handleApiError } from '../lib/api-client';
import { companyApi } from '../services/company';

import type { CompanySettings } from '../types/company';

/**
 * Loading skeleton for the settings page.
 */
function SettingsSkeleton(): React.ReactElement {
  return (
    <Box>
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 1 }} />
      <Skeleton variant="text" width={350} height={24} sx={{ mb: 3 }} />
      <Card>
        <CardHeader
          avatar={<Skeleton variant="circular" width={40} height={40} />}
          title={<Skeleton variant="text" width={150} />}
        />
        <CardContent>
          <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
          <Skeleton variant="text" width="80%" />
        </CardContent>
      </Card>
    </Box>
  );
}

/**
 * Company settings page component.
 * Displays and allows editing of company-wide settings.
 */
export function CompanySettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Local form state for MFA toggle
  const [mfaRequired, setMfaRequired] = useState(false);

  /**
   * Fetches company settings from the API.
   */
  const fetchSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await companyApi.getSettings();
      setSettings(response.settings);
      setMfaRequired(response.settings.mfaRequired);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  /**
   * Handles MFA toggle change.
   */
  function handleMfaToggle(checked: boolean): void {
    setMfaRequired(checked);
    setHasChanges(checked !== settings?.mfaRequired);
    setSuccessMessage(null);
  }

  /**
   * Saves the settings to the API.
   */
  async function handleSave(): Promise<void> {
    if (!hasChanges) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await companyApi.updateSettings({ mfaRequired });
      setSettings(response.settings);
      setHasChanges(false);
      setSuccessMessage('Settings saved successfully');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Resets form to original settings.
   */
  function handleReset(): void {
    if (settings) {
      setMfaRequired(settings.mfaRequired);
      setHasChanges(false);
      setSuccessMessage(null);
    }
  }

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Company Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure company-wide settings and security policies.
        </Typography>
      </Box>

      {/* Success Message */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => setSuccessMessage(null)}
          data-testid="settings-success-alert"
        >
          {successMessage}
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
          data-testid="settings-error-alert"
        >
          {error}
        </Alert>
      )}

      {/* Logo Library Section */}
      <Box sx={{ mb: 3 }}>
        <LogoLibrarySection />
      </Box>

      {/* Security Section */}
      <Card sx={{ mb: 3 }} data-testid="security-section">
        <CardHeader
          avatar={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
              }}
            >
              <SecurityIcon />
            </Box>
          }
          title={
            <Typography variant="h6" component="h2">
              Security
            </Typography>
          }
          subheader="Configure authentication and security settings"
        />
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <LockOutlinedIcon color="action" sx={{ mt: 0.5 }} />
            <Box sx={{ flex: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={mfaRequired}
                    onChange={e => handleMfaToggle(e.target.checked)}
                    disabled={isSaving}
                    data-testid="mfa-toggle"
                  />
                }
                label={
                  <Typography variant="subtitle1" fontWeight="medium">
                    Require Multi-Factor Authentication (MFA)
                  </Typography>
                }
                sx={{ mb: 0.5 }}
              />
              <Typography variant="body2" color="text.secondary">
                When enabled, all users in your company will be required to set
                up and use MFA when logging in through client apps. This
                provides an additional layer of security for user accounts.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Company Info (Read-only) */}
      {settings && (
        <Card sx={{ mb: 3 }} data-testid="company-info-section">
          <CardHeader
            title={
              <Typography variant="h6" component="h2">
                Company Information
              </Typography>
            }
            subheader="Basic company details (read-only)"
          />
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Company Name
                </Typography>
                <Typography variant="body1">{settings.companyName}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1">
                  {new Date(settings.updatedAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        {hasChanges && (
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={isSaving}
            data-testid="reset-btn"
          >
            Reset
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={!hasChanges || isSaving}
          startIcon={
            isSaving ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <SaveIcon />
            )
          }
          data-testid="save-settings-btn"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
}
