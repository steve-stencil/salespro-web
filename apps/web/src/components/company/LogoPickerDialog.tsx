/**
 * Dialog for selecting a logo from the company's logo library.
 * Used by offices to pick a logo from the available options.
 */
import AddIcon from '@mui/icons-material/Add';
import CollectionsIcon from '@mui/icons-material/Collections';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useState, useEffect, useCallback } from 'react';

import { handleApiError } from '../../lib/api-client';
import { companyApi } from '../../services/company';

import { LogoCard } from './LogoCard';
import { LogoUploadDialog } from './LogoUploadDialog';

import type { CompanyLogoLibraryItem } from '../../types/company';

type LogoPickerDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Currently selected logo ID (if any) */
  selectedLogoId?: string | null;
  /** Callback when the dialog is closed */
  onClose: () => void;
  /** Callback when a logo is selected */
  onSelect: (logo: CompanyLogoLibraryItem) => void;
  /** Callback when a new logo is uploaded (logo is auto-selected) */
  onUpload?: (
    file: File,
    name: string,
  ) => Promise<CompanyLogoLibraryItem | undefined>;
  /** Title for the dialog */
  title?: string;
};

type TabValue = 'library' | 'upload';

/**
 * Dialog for selecting a logo from the company library.
 */
export function LogoPickerDialog({
  open,
  selectedLogoId,
  onClose,
  onSelect,
  onUpload,
  title = 'Select Logo',
}: LogoPickerDialogProps): React.ReactElement {
  const [logos, setLogos] = useState<CompanyLogoLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] =
    useState<CompanyLogoLibraryItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('library');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Fetch logo library from API.
   */
  const fetchLogos = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await companyApi.getLogoLibrary();
      setLogos(response.logos);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch logos when dialog opens
  useEffect(() => {
    if (open) {
      void fetchLogos();
      setPendingSelection(null);
      setActiveTab('library');
    }
  }, [open, fetchLogos]);

  /**
   * Handle logo selection.
   */
  function handleLogoClick(logo: CompanyLogoLibraryItem): void {
    setPendingSelection(logo);
  }

  /**
   * Handle confirm selection.
   */
  function handleConfirm(): void {
    if (pendingSelection) {
      onSelect(pendingSelection);
      onClose();
    }
  }

  /**
   * Handle upload from picker.
   */
  async function handleUpload(file: File, name: string): Promise<void> {
    if (!onUpload) {
      // Fall back to library upload and select
      setIsUploading(true);
      try {
        const response = await companyApi.addLogoToLibrary(file, name);
        // Auto-select the uploaded logo
        setPendingSelection(response.logo);
        setActiveTab('library');
        await fetchLogos();
      } catch (err) {
        throw new Error(handleApiError(err));
      } finally {
        setIsUploading(false);
      }
      return;
    }

    setIsUploading(true);
    try {
      const uploadedLogo = await onUpload(file, name);
      if (uploadedLogo) {
        setPendingSelection(uploadedLogo);
      }
      setActiveTab('library');
      await fetchLogos();
    } catch (err) {
      throw new Error(handleApiError(err));
    } finally {
      setIsUploading(false);
    }
  }

  // Determine the effective selected logo
  const effectiveSelectedId = pendingSelection?.id ?? selectedLogoId;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        aria-labelledby="logo-picker-dialog-title"
      >
        <DialogTitle id="logo-picker-dialog-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CollectionsIcon color="primary" />
            {title}
          </Box>
        </DialogTitle>

        <Tabs
          value={activeTab}
          onChange={(_, value: TabValue) => setActiveTab(value)}
          sx={{ px: 3 }}
        >
          <Tab label="Select from Library" value="library" />
          <Tab
            label="Upload New"
            value="upload"
            icon={<AddIcon />}
            iconPosition="start"
          />
        </Tabs>

        <Divider />

        <DialogContent sx={{ minHeight: 400 }}>
          {activeTab === 'library' && (
            <>
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

              {/* Loading state */}
              {isLoading ? (
                <Grid container spacing={2}>
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
                      <Skeleton variant="rectangular" height={160} />
                    </Grid>
                  ))}
                </Grid>
              ) : logos.length === 0 ? (
                /* Empty state */
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    px: 2,
                  }}
                >
                  <CollectionsIcon
                    sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    No logos in the library yet
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Upload a logo to get started.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setActiveTab('upload')}
                  >
                    Upload Logo
                  </Button>
                </Box>
              ) : (
                /* Logo grid */
                <Grid container spacing={2}>
                  {logos.map(logo => (
                    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={logo.id}>
                      <LogoCard
                        logo={logo}
                        isSelected={effectiveSelectedId === logo.id}
                        onSelect={handleLogoClick}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}

          {activeTab === 'upload' && (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload a new logo to the company library. It will be added to
                the library and automatically selected for this office.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setUploadDialogOpen(true)}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Choose File to Upload'}
              </Button>
            </Box>
          )}
        </DialogContent>

        <Divider />

        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={!pendingSelection}
            startIcon={
              isUploading ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {pendingSelection
              ? `Select "${pendingSelection.name}"`
              : 'Select Logo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload dialog */}
      <LogoUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUpload={handleUpload}
        isUploading={isUploading}
      />
    </>
  );
}
