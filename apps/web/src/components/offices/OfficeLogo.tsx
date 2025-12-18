/**
 * Office logo display component.
 * Shows the office logo with fallback to an icon when no logo is set.
 */
import BusinessIcon from '@mui/icons-material/Business';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import { useState } from 'react';

import type { LogoInfo } from '../../types/office-settings';
import type { SxProps, Theme } from '@mui/material/styles';

type OfficeLogoProps = {
  /** Logo information from office settings */
  logo: LogoInfo | null | undefined;
  /** Office name for alt text and fallback */
  officeName: string;
  /** Size of the avatar (default: 48) */
  size?: number;
  /** Whether the logo is loading */
  isLoading?: boolean;
  /** Optional custom sx props */
  sx?: SxProps<Theme>;
  /** Whether to use thumbnail URL (default: false) */
  useThumbnail?: boolean;
};

/**
 * Get initials from office name for fallback display.
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Displays an office logo with fallback to initials or icon.
 */
export function OfficeLogo({
  logo,
  officeName,
  size = 48,
  isLoading = false,
  sx,
  useThumbnail = false,
}: OfficeLogoProps): React.ReactElement {
  const [imageError, setImageError] = useState(false);

  // Determine which URL to use
  const imageUrl =
    useThumbnail && logo?.thumbnailUrl ? logo.thumbnailUrl : logo?.url;

  // Reset error state when logo changes
  const handleImageLoad = (): void => {
    setImageError(false);
  };

  const handleImageError = (): void => {
    setImageError(true);
  };

  if (isLoading) {
    return <Skeleton variant="circular" width={size} height={size} />;
  }

  // Show image if we have a URL and no error
  if (logo && imageUrl && !imageError) {
    return (
      <Avatar
        src={imageUrl}
        alt={`${officeName} logo`}
        sx={{
          width: size,
          height: size,
          bgcolor: 'grey.100',
          ...sx,
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
      >
        {/* Fallback content if image fails to load */}
        <BusinessIcon sx={{ fontSize: size * 0.5, color: 'grey.400' }} />
      </Avatar>
    );
  }

  // Show initials or icon fallback
  const initials = getInitials(officeName);

  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: 'primary.light',
        color: 'primary.contrastText',
        fontSize: size * 0.35,
        fontWeight: 600,
        ...sx,
      }}
      aria-label={`${officeName} (no logo)`}
    >
      {initials || <BusinessIcon sx={{ fontSize: size * 0.5 }} />}
    </Avatar>
  );
}
