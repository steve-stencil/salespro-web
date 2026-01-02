/**
 * Dialog for uploading a new logo to the company library.
 */
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import {
  LOGO_CONFIG,
  formatFileSize,
  isValidLogoType,
} from '../../types/office-settings';

type LogoUploadDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog is closed */
  onClose: () => void;
  /** Callback when a logo is uploaded */
  onUpload: (file: File, name: string) => Promise<void>;
  /** Whether upload is in progress */
  isUploading?: boolean;
};

/**
 * Dialog for uploading a new logo to the company library.
 */
export function LogoUploadDialog({
  open,
  onClose,
  onUpload,
  isUploading = false,
}: LogoUploadDialogProps): React.ReactElement {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Reset form state.
   */
  const resetForm = useCallback((): void => {
    setSelectedFile(null);
    setPreview(null);
    setName('');
    setError(null);
  }, []);

  /**
   * Handle file drop/selection.
   */
  const onDrop = useCallback(
    (acceptedFiles: File[]): void => {
      setError(null);
      const file = acceptedFiles[0];

      if (!file) {
        return;
      }

      // Validate file type
      if (!isValidLogoType(file.type)) {
        setError(
          `Invalid file type. Allowed types: ${LOGO_CONFIG.allowedExtensions.join(', ')}`,
        );
        return;
      }

      // Validate file size
      if (file.size > LOGO_CONFIG.maxSizeBytes) {
        setError(
          `File too large. Maximum size is ${formatFileSize(LOGO_CONFIG.maxSizeBytes)}`,
        );
        return;
      }

      setSelectedFile(file);

      // Generate preview
      const reader = new FileReader();
      reader.onload = e => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Set default name from filename (without extension)
      if (!name) {
        const defaultName = file.name.replace(/\.[^.]+$/, '');
        setName(defaultName);
      }
    },
    [name],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  /**
   * Handle dialog close.
   */
  function handleClose(): void {
    if (!isUploading) {
      resetForm();
      onClose();
    }
  }

  /**
   * Handle upload submission.
   */
  async function handleUpload(): Promise<void> {
    if (!selectedFile || !name.trim()) {
      return;
    }

    setError(null);
    try {
      await onUpload(selectedFile, name.trim());
      resetForm();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to upload logo');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="upload-logo-dialog-title"
    >
      <DialogTitle id="upload-logo-dialog-title">
        Add Logo to Library
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Drop zone */}
        <Box
          {...getRootProps()}
          sx={{
            border: 2,
            borderStyle: 'dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            bgcolor: isDragActive ? 'primary.50' : 'background.default',
            transition: 'all 0.2s',
            mb: 2,
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'primary.50',
            },
          }}
        >
          <input {...getInputProps()} />

          {preview ? (
            <Box>
              <Box
                component="img"
                src={preview}
                alt="Preview"
                sx={{
                  maxHeight: 150,
                  maxWidth: '100%',
                  objectFit: 'contain',
                  mb: 1,
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {selectedFile?.name} ({formatFileSize(selectedFile?.size ?? 0)})
              </Typography>
              <Typography variant="caption" color="primary">
                Click or drag to replace
              </Typography>
            </Box>
          ) : (
            <Box>
              <CloudUploadIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }}
              />
              <Typography variant="body1" gutterBottom>
                {isDragActive
                  ? 'Drop the logo here...'
                  : 'Drag and drop a logo, or click to select'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                PNG, JPG, or WebP • Max{' '}
                {formatFileSize(LOGO_CONFIG.maxSizeBytes)} •{' '}
                {LOGO_CONFIG.minWidth}x{LOGO_CONFIG.minHeight} to{' '}
                {LOGO_CONFIG.maxWidth}x{LOGO_CONFIG.maxHeight}px
              </Typography>
            </Box>
          )}
        </Box>

        {/* Logo name input */}
        <TextField
          label="Logo Name"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth
          required
          disabled={isUploading}
          placeholder="e.g., Main Logo, Holiday Logo"
          helperText="A friendly name to identify this logo in the library"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleUpload()}
          disabled={!selectedFile || !name.trim() || isUploading}
          startIcon={
            isUploading ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {isUploading ? 'Uploading...' : 'Upload Logo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

