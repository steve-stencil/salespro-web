/**
 * Document Template Tile component.
 * Displays a single template with thumbnail, name, and selection state.
 * Based on iOS: ContractPagesSelectionTableViewCell
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ImageIcon from '@mui/icons-material/Image';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';

import { DocumentTemplateStepper } from './DocumentTemplateStepper';

import type { DocumentTemplateTileProps } from '../types/document';
import type React from 'react';

/** Tile dimensions matching iOS layout */
const TILE_WIDTH = 140;
const TILE_HEIGHT = 180;
const THUMBNAIL_HEIGHT = 120;

/**
 * Tile component displaying a document template.
 * Shows thumbnail, name, selection indicator, and stepper for multi-page templates.
 *
 * @param props - Tile props
 * @returns Tile element
 */
export function DocumentTemplateTile({
  template,
  isSelected,
  addedCount,
  onToggle,
  onPageCountChange,
  isLoading = false,
}: DocumentTemplateTileProps): React.ReactElement {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleClick = useCallback((): void => {
    if (!isLoading) {
      onToggle(template.id);
    }
  }, [template.id, onToggle, isLoading]);

  const handleStepperChange = useCallback(
    (newCount: number): void => {
      onPageCountChange(template.id, newCount);
    },
    [template.id, onPageCountChange],
  );

  const handleImageLoad = useCallback((): void => {
    setImageLoading(false);
  }, []);

  const handleImageError = useCallback((): void => {
    setImageError(true);
    setImageLoading(false);
  }, []);

  const thumbnailSrc = template.thumbnailUrl ?? template.iconUrl;
  const showPlaceholder = !thumbnailSrc || imageError;

  return (
    <ButtonBase
      onClick={handleClick}
      disabled={isLoading}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        borderRadius: 1,
        overflow: 'hidden',
        border: '2px solid',
        borderColor: isSelected ? 'primary.main' : 'grey.300',
        bgcolor: 'background.paper',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        '&:hover': {
          borderColor: isSelected ? 'primary.dark' : 'grey.400',
          boxShadow: 1,
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
      aria-pressed={isSelected}
      aria-label={`${template.displayName}${isSelected ? ', selected' : ''}`}
    >
      {/* Selection overlay */}
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(46, 125, 50, 0.1)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Loading overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 3,
          }}
        >
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Selection checkmark */}
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 2,
            bgcolor: 'background.paper',
            borderRadius: '50%',
          }}
        >
          <CheckCircleIcon
            sx={{
              color: 'primary.main',
              fontSize: 24,
            }}
          />
        </Box>
      )}

      {/* Thumbnail */}
      <Box
        sx={{
          width: '100%',
          height: THUMBNAIL_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {imageLoading && !showPlaceholder && (
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            animation="wave"
          />
        )}
        {showPlaceholder ? (
          <ImageIcon
            sx={{
              fontSize: 48,
              color: 'grey.400',
            }}
          />
        ) : (
          <Box
            component="img"
            src={thumbnailSrc}
            alt={template.displayName}
            onLoad={handleImageLoad}
            onError={handleImageError}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: imageLoading ? 'none' : 'block',
            }}
          />
        )}
      </Box>

      {/* Footer with name and controls */}
      <Box
        sx={{
          flex: 1,
          width: '100%',
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: TILE_HEIGHT - THUMBNAIL_HEIGHT,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 500,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.2,
            width: '100%',
          }}
        >
          {template.displayName}
        </Typography>

        {/* Multi-page stepper and count badge */}
        {template.canAddMultiplePages && isSelected && (
          <Box
            sx={{
              mt: 0.5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <DocumentTemplateStepper
              value={addedCount}
              min={1}
              onChange={handleStepperChange}
            />
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                fontWeight: 500,
                fontSize: '0.65rem',
              }}
            >
              {addedCount} Added
            </Typography>
          </Box>
        )}
      </Box>
    </ButtonBase>
  );
}

/**
 * Skeleton loader for DocumentTemplateTile.
 * Shows placeholder while templates are loading.
 */
export function DocumentTemplateTileSkeleton(): React.ReactElement {
  return (
    <Box
      sx={{
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        borderRadius: 1,
        overflow: 'hidden',
        border: '2px solid',
        borderColor: 'grey.200',
      }}
    >
      <Skeleton
        variant="rectangular"
        width="100%"
        height={THUMBNAIL_HEIGHT}
        animation="wave"
      />
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
      </Box>
    </Box>
  );
}
