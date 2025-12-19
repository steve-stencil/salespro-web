/**
 * Logo Library section component for the Company Settings page.
 * Displays the company's logo library with management actions.
 */
import AddIcon from '@mui/icons-material/Add';
import CollectionsIcon from '@mui/icons-material/Collections';
import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useEffect } from 'react';

import { handleApiError } from '../../lib/api-client';
import { companyApi } from '../../services/company';

import { LogoCard } from './LogoCard';
import { LogoUploadDialog } from './LogoUploadDialog';

import type { CompanyLogoLibraryItem } from '../../types/company';

/**
 * Logo Library section for managing company logos.
 */
export function LogoLibrarySection(): React.ReactElement {
  const [logos, setLogos] = useState<CompanyLogoLibraryItem[]>([]);
  const [defaultLogoId, setDefaultLogoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLogo, setEditingLogo] = useState<CompanyLogoLibraryItem | null>(
    null,
  );
  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLogo, setDeletingLogo] =
    useState<CompanyLogoLibraryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Set default state
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  /**
   * Fetch logo library from API.
   */
  const fetchLogos = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await companyApi.getLogoLibrary();
      setLogos(response.logos);
      setDefaultLogoId(response.defaultLogoId);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch logos on mount
  useEffect(() => {
    void fetchLogos();
  }, [fetchLogos]);

  /**
   * Handle logo upload.
   */
  async function handleUpload(file: File, name: string): Promise<void> {
    setIsUploading(true);
    setError(null);
    try {
      await companyApi.addLogoToLibrary(file, name);
      setSuccessMessage('Logo added to library');
      await fetchLogos();
    } catch (err) {
      throw new Error(handleApiError(err));
    } finally {
      setIsUploading(false);
    }
  }

  /**
   * Handle edit button click.
   */
  function handleEditClick(logo: CompanyLogoLibraryItem): void {
    setEditingLogo(logo);
    setEditName(logo.name);
    setEditDialogOpen(true);
  }

  /**
   * Handle edit submission.
   */
  async function handleEditSubmit(): Promise<void> {
    if (!editingLogo || !editName.trim()) return;

    setIsEditing(true);
    setError(null);
    try {
      await companyApi.updateLogo(editingLogo.id, editName.trim());
      setSuccessMessage('Logo name updated');
      setEditDialogOpen(false);
      setEditingLogo(null);
      await fetchLogos();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsEditing(false);
    }
  }

  /**
   * Handle delete button click.
   */
  function handleDeleteClick(logo: CompanyLogoLibraryItem): void {
    setDeletingLogo(logo);
    setDeleteDialogOpen(true);
  }

  /**
   * Handle delete confirmation.
   */
  async function handleDeleteConfirm(): Promise<void> {
    if (!deletingLogo) return;

    setIsDeleting(true);
    setError(null);
    try {
      await companyApi.deleteLogo(deletingLogo.id);
      setSuccessMessage('Logo removed from library');
      setDeleteDialogOpen(false);
      setDeletingLogo(null);
      await fetchLogos();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsDeleting(false);
    }
  }

  /**
   * Handle set default.
   */
  async function handleSetDefault(logo: CompanyLogoLibraryItem): Promise<void> {
    setIsSettingDefault(true);
    setError(null);
    try {
      await companyApi.setDefaultLogo(logo.id);
      setSuccessMessage(`"${logo.name}" set as default logo`);
      await fetchLogos();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsSettingDefault(false);
    }
  }

  // Get the default logo for display
  const defaultLogo = logos.find(l => l.id === defaultLogoId);

  return (
    <Card data-testid="logo-library-section">
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
              bgcolor: 'secondary.light',
              color: 'secondary.contrastText',
            }}
          >
            <CollectionsIcon />
          </Box>
        }
        title={
          <Typography variant="h6" component="h2">
            Logo Library
          </Typography>
        }
        subheader="Manage logos for your company and offices"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => void fetchLogos()}
                disabled={isLoading}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUploadDialogOpen(true)}
              size="small"
            >
              Add Logo
            </Button>
          </Box>
        }
      />

      <CardContent>
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

        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading state */}
        {isLoading ? (
          <Box>
            <Skeleton variant="text" width={200} sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {[1, 2, 3, 4].map(i => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
                  <Skeleton variant="rectangular" height={180} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : logos.length === 0 ? (
          /* Empty state */
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              px: 2,
              bgcolor: 'background.default',
              borderRadius: 1,
            }}
          >
            <CollectionsIcon
              sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="h6" gutterBottom>
              No logos in your library yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add logos to your library to use them across your company and
              offices.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Add Your First Logo
            </Button>
          </Box>
        ) : (
          <>
            {/* Default logo section */}
            {defaultLogo && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  Default Logo (inherited by offices without a logo)
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    bgcolor: 'primary.50',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'primary.200',
                  }}
                >
                  <Box
                    component="img"
                    src={defaultLogo.thumbnailUrl ?? defaultLogo.url}
                    alt={defaultLogo.name}
                    sx={{
                      width: 64,
                      height: 64,
                      objectFit: 'contain',
                      bgcolor: 'white',
                      borderRadius: 1,
                      p: 1,
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {defaultLogo.name}
                    </Typography>
                    {defaultLogo.usedByOfficeCount > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Used by {defaultLogo.usedByOfficeCount} office
                        {defaultLogo.usedByOfficeCount !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            {/* Logo grid */}
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              All Logos ({logos.length})
            </Typography>
            <Grid container spacing={2}>
              {logos.map(logo => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={logo.id}>
                  <LogoCard
                    logo={logo}
                    onEdit={handleEditClick}
                    onSetDefault={logo => void handleSetDefault(logo)}
                    onDelete={handleDeleteClick}
                    disabled={isSettingDefault}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </CardContent>

      {/* Upload dialog */}
      <LogoUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUpload={handleUpload}
        isUploading={isUploading}
      />

      {/* Edit dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !isEditing && setEditDialogOpen(false)}
      >
        <DialogTitle>Edit Logo Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Logo Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            disabled={isEditing}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={isEditing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleEditSubmit()}
            disabled={!editName.trim() || isEditing}
            startIcon={
              isEditing ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {isEditing ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Logo</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{deletingLogo?.name}" from your
            logo library? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDeleteConfirm()}
            disabled={isDeleting}
            startIcon={
              isDeleting ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
