/**
 * TagChip - A colored chip component for displaying tags.
 * Uses the tag's hex color for background with automatic contrast text.
 */
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { Chip, styled } from '@mui/material';

import type { TagSummary } from '@shared/types';

export type TagChipProps = {
  /** Tag to display */
  tag: TagSummary;
  /** Size variant */
  size?: 'small' | 'medium';
  /** Called when delete button is clicked (only shown if provided) */
  onDelete?: () => void;
  /** Click handler for the chip */
  onClick?: () => void;
};

/**
 * Determines if a color is "light" and needs dark text.
 * Uses relative luminance formula.
 */
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

const StyledChip = styled(Chip)<{ tagcolor: string }>(({ tagcolor }) => {
  const isLight = isLightColor(tagcolor);
  return {
    backgroundColor: tagcolor,
    color: isLight ? '#1a1a1a' : '#ffffff',
    '& .MuiChip-deleteIcon': {
      color: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.7)',
      '&:hover': {
        color: isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 1)',
      },
    },
    '& .MuiChip-icon': {
      color: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
    },
  };
});

export function TagChip({
  tag,
  size = 'small',
  onDelete,
  onClick,
}: TagChipProps): React.ReactElement {
  return (
    <StyledChip
      tagcolor={tag.color}
      label={tag.name}
      size={size}
      icon={<LocalOfferIcon />}
      onDelete={onDelete}
      onClick={onClick}
      clickable={!!onClick}
    />
  );
}
