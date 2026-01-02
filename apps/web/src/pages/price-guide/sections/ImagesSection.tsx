/**
 * Images Section Component.
 * Manages the thumbnail image for an MSI from the shared image library.
 * Uses the reusable ImagePicker component for selection/upload.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

import { ImagePicker } from '../../../components/price-guide/ImagePicker';

import type { SelectedImageData } from '../../../components/price-guide/ImagePicker';
import type { ThumbnailImage } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

export type ImagesSectionProps = {
  /** Current thumbnail image (if any) */
  thumbnailImage: ThumbnailImage | null;
  /** Currently selected thumbnail image ID */
  thumbnailImageId: string | null;
  /** Callback when thumbnail selection changes */
  onThumbnailChange: (imageId: string | null) => void;
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Section for managing the thumbnail image on an MSI.
 * Allows selecting from library or uploading a new image.
 */
export function ImagesSection({
  thumbnailImage,
  thumbnailImageId,
  onThumbnailChange,
}: ImagesSectionProps): React.ReactElement {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleOpenPicker = useCallback(() => {
    setIsPickerOpen(true);
  }, []);

  const handleClosePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  const handleSelectionChange = useCallback(
    (imageIds: string[], _selectedImages: SelectedImageData[]) => {
      // Single selection mode - take first image or null
      const newThumbnailId = imageIds.length > 0 ? imageIds[0]! : null;
      onThumbnailChange(newThumbnailId);
      setIsPickerOpen(false);
    },
    [onThumbnailChange],
  );

  const handleClearThumbnail = useCallback(() => {
    onThumbnailChange(null);
  }, [onThumbnailChange]);

  const thumbnailUrl =
    thumbnailImage?.thumbnailUrl ?? thumbnailImage?.imageUrl ?? null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Thumbnail Image
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set a thumbnail image to help identify this item. You can select from
        the library or upload a new image.
      </Typography>

      {/* Thumbnail display */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          cursor: 'pointer',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
        onClick={handleOpenPicker}
      >
        {thumbnailUrl ? (
          <Box
            component="img"
            src={thumbnailUrl}
            alt={thumbnailImage?.name ?? 'Thumbnail'}
            sx={{
              width: 80,
              height: 80,
              objectFit: 'cover',
              borderRadius: 1,
            }}
          />
        ) : (
          <Box
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'grey.200',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No image
            </Typography>
          </Box>
        )}

        <Box sx={{ flex: 1 }}>
          {thumbnailImage ? (
            <>
              <Typography variant="body2" fontWeight="medium">
                {thumbnailImage.name}
              </Typography>
              {thumbnailImage.description && (
                <Typography variant="caption" color="text.secondary">
                  {thumbnailImage.description}
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Click to select a thumbnail image
            </Typography>
          )}
        </Box>

        {thumbnailImageId && (
          <Box
            component="span"
            onClick={e => {
              e.stopPropagation();
              handleClearThumbnail();
            }}
            sx={{
              cursor: 'pointer',
              color: 'error.main',
              fontSize: '0.875rem',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Clear
          </Box>
        )}
      </Box>

      <ImagePicker
        open={isPickerOpen}
        onClose={handleClosePicker}
        selectedImageIds={thumbnailImageId ? [thumbnailImageId] : []}
        onSelectionChange={handleSelectionChange}
        multiple={false}
        title="Select Thumbnail Image"
      />
    </Box>
  );
}
