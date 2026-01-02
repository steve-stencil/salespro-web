/**
 * MSI Thumbnail Upload Component.
 * Provides drag & drop and click-to-upload functionality for MSI product images.
 *
 * This component creates a LOCAL preview only - actual upload happens when the MSI is saved.
 */

import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useId, useEffect } from 'react';

import type { MsiImage, PendingImage } from './wizard';
import type { SxProps, Theme } from '@mui/material/styles';

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size for thumbnails (2MB) */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Allowed file extensions for display */
const ALLOWED_EXTENSIONS = ['JPG', 'PNG', 'WebP', 'GIF'];

// ============================================================================
// Types
// ============================================================================

export type MsiThumbnailUploadProps = {
  /** Current image (existing or pending) */
  image: MsiImage | null;
  /** Callback when a file is selected (creates pending image) */
  onFileSelected: (pendingImage: PendingImage) => void;
  /** Callback when image is removed */
  onImageRemoved: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Custom styles */
  sx?: SxProps<Theme>;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate an image file.
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get display URL from image (existing or pending).
 */
function getDisplayUrl(image: MsiImage | null): string | null {
  if (!image) return null;
  if (image.type === 'pending') return image.previewUrl;
  // For existing images, prefer thumbnail for performance
  return image.thumbnailUrl ?? image.url;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Thumbnail upload component for MSI product images.
 * Supports drag & drop and click-to-browse functionality.
 *
 * NOTE: This component only creates a LOCAL preview. The actual upload
 * happens when the MSI is saved via the parent component.
 */
export function MsiThumbnailUpload({
  image,
  onFileSelected,
  onImageRemoved,
  disabled = false,
  sx,
}: MsiThumbnailUploadProps): React.ReactElement {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  // Cleanup preview URLs when component unmounts or image changes
  useEffect(() => {
    return () => {
      // Revoke preview URL when image changes to prevent memory leaks
      if (image?.type === 'pending') {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, [image]);

  /**
   * Handle file selection - creates local preview, no upload.
   */
  const handleFile = useCallback(
    (file: File): void => {
      setError(null);

      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error ?? 'Invalid file');
        return;
      }

      // Create local preview URL
      const previewUrl = URL.createObjectURL(file);

      // Pass pending image to parent
      onFileSelected({
        type: 'pending',
        file,
        previewUrl,
      });
    },
    [onFileSelected],
  );

  /**
   * Handle drag enter event.
   */
  const handleDragEnter = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled],
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

      if (disabled) return;

      const files = e.dataTransfer.files;
      const firstFile = files[0];
      if (firstFile) {
        handleFile(firstFile);
      }
    },
    [disabled, handleFile],
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
   * Handle remove image.
   */
  const handleRemove = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      setError(null);
      onImageRemoved();
    },
    [onImageRemoved],
  );

  const displayUrl = getDisplayUrl(image);

  return (
    <Box sx={sx}>
      {/* Hidden file input */}
      <input
        id={inputId}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Upload zone / Image display */}
      {/* Using native label for proper file input triggering */}
      <label
        htmlFor={inputId}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          width: 150,
          height: 150,
          border: '2px dashed',
          borderColor: isDragging ? '#1976d2' : image ? '#e0e0e0' : '#bdbdbd',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isDragging ? '#e3f2fd' : '#fff',
          transition: 'all 0.2s',
          overflow: 'hidden',
        }}
      >
        {displayUrl ? (
          // Image preview (existing or pending)
          <>
            <Box
              component="img"
              src={displayUrl}
              alt="Product thumbnail"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Remove button overlay */}
            {!disabled && (
              <IconButton
                onClick={handleRemove}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  bgcolor: 'error.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'error.dark',
                  },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
            {/* Pending indicator */}
            {image?.type === 'pending' && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  bgcolor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  py: 0.5,
                  textAlign: 'center',
                }}
              >
                <Typography variant="caption">Unsaved</Typography>
              </Box>
            )}
          </>
        ) : (
          // Empty state
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              p: 2,
            }}
          >
            <AddPhotoAlternateIcon
              sx={{ fontSize: 40, color: 'action.disabled' }}
            />
            <Typography variant="caption" color="text.secondary" align="center">
              Click or drag
              <br />
              to upload
            </Typography>
          </Box>
        )}
      </label>

      {/* Helper text */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block' }}
      >
        {ALLOWED_EXTENSIONS.join(', ')} • Max {formatFileSize(MAX_FILE_SIZE)}
      </Typography>
    </Box>
  );
}
