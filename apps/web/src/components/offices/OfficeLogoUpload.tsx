/**
 * Office logo upload component with drag & drop support.
 * Provides a user-friendly interface for uploading office logos.
 */
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useState, useRef } from 'react';

import {
  LOGO_CONFIG,
  isValidLogoType,
  formatFileSize,
} from '../../types/office-settings';

import { OfficeLogo } from './OfficeLogo';

import type { LogoInfo } from '../../types/office-settings';
import type { SxProps, Theme } from '@mui/material/styles';

type OfficeLogoUploadProps = {
  /** Current logo info */
  logo: LogoInfo | null | undefined;
  /** Office name for display */
  officeName: string;
  /** Callback when a file is selected */
  onFileSelect: (file: File) => void;
  /** Callback when logo removal is requested */
  onRemove: () => void;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Whether removal is in progress */
  isRemoving?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Optional custom sx props */
  sx?: SxProps<Theme>;
};

/**
 * Validates a file for logo upload.
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!isValidLogoType(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${LOGO_CONFIG.allowedExtensions.join(', ')}`,
    };
  }

  // Check file size
  if (file.size > LOGO_CONFIG.maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${formatFileSize(LOGO_CONFIG.maxSizeBytes)}`,
    };
  }

  return { valid: true };
}

/**
 * Component for uploading office logos with drag & drop support.
 */
export function OfficeLogoUpload({
  logo,
  officeName,
  onFileSelect,
  onRemove,
  isUploading = false,
  isRemoving = false,
  disabled = false,
  sx,
}: OfficeLogoUploadProps): React.ReactElement {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessing = isUploading || isRemoving;
  const isDisabled = disabled || isProcessing;

  /**
   * Handle file selection from input or drop.
   */
  const handleFile = useCallback(
    (file: File): void => {
      setValidationError(null);

      const validation = validateFile(file);
      if (!validation.valid) {
        setValidationError(validation.error ?? 'Invalid file');
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect],
  );

  /**
   * Handle drag enter event.
   */
  const handleDragEnter = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDisabled) {
        setIsDragging(true);
      }
    },
    [isDisabled],
  );

  /**
   * Handle drag leave event.
   */
  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handle drag over event.
   */
  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle drop event.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (isDisabled) return;

      const files = e.dataTransfer.files;
      const firstFile = files[0];
      if (firstFile) {
        handleFile(firstFile);
      }
    },
    [isDisabled, handleFile],
  );

  /**
   * Handle file input change.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const files = e.target.files;
      const firstFile = files?.[0];
      if (firstFile) {
        handleFile(firstFile);
      }
      // Reset input value to allow re-selecting the same file
      e.target.value = '';
    },
    [handleFile],
  );

  /**
   * Open file picker dialog.
   */
  const handleBrowseClick = (): void => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={sx}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={LOGO_CONFIG.allowedTypes.join(',')}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-label="Upload office logo"
      />

      {/* Current logo display with remove option */}
      {logo && !isUploading && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
            p: 2,
            bgcolor: 'grey.50',
            borderRadius: 1,
            border: 1,
            borderColor: 'grey.200',
          }}
        >
          <OfficeLogo logo={logo} officeName={officeName} size={64} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              Current Logo
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {logo.filename}
            </Typography>
          </Box>
          <Tooltip title="Remove logo">
            <IconButton
              onClick={onRemove}
              disabled={isDisabled}
              color="error"
              size="small"
              aria-label="Remove logo"
            >
              {isRemoving ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <DeleteIcon />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Validation error */}
      {validationError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setValidationError(null)}
        >
          {validationError}
        </Alert>
      )}

      {/* Drop zone */}
      <Box
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={isDisabled ? undefined : handleBrowseClick}
        sx={{
          p: 4,
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragging
            ? 'primary.main'
            : isDisabled
              ? 'grey.300'
              : 'grey.400',
          borderRadius: 2,
          bgcolor: isDragging
            ? 'primary.50'
            : isDisabled
              ? 'grey.100'
              : 'background.paper',
          textAlign: 'center',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': isDisabled
            ? {}
            : {
                borderColor: 'primary.main',
                bgcolor: 'primary.50',
              },
        }}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Drop zone for logo upload"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isDisabled) handleBrowseClick();
          }
        }}
      >
        {isUploading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              Uploading logo...
            </Typography>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 1,
              }}
            >
              {isDragging ? (
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              ) : (
                <ImageIcon
                  sx={{
                    fontSize: 48,
                    color: isDisabled ? 'grey.400' : 'grey.500',
                  }}
                />
              )}
            </Box>

            <Typography
              variant="body1"
              color={isDisabled ? 'text.disabled' : 'text.primary'}
              gutterBottom
            >
              {isDragging
                ? 'Drop your logo here'
                : 'Drag & drop your logo here'}
            </Typography>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              or
            </Typography>

            <Button
              variant="outlined"
              size="small"
              disabled={isDisabled}
              onClick={e => {
                e.stopPropagation();
                handleBrowseClick();
              }}
              startIcon={<CloudUploadIcon />}
            >
              Browse Files
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 2 }}
            >
              Supported formats: {LOGO_CONFIG.allowedExtensions.join(', ')}
              <br />
              Maximum size: {formatFileSize(LOGO_CONFIG.maxSizeBytes)}
              <br />
              Dimensions: {LOGO_CONFIG.minWidth}x{LOGO_CONFIG.minHeight} to{' '}
              {LOGO_CONFIG.maxWidth}x{LOGO_CONFIG.maxHeight} pixels
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
