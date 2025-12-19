/**
 * Office logo display component.
 * Shows the office logo with fallback to company default or initials.
 *
 * Logo inheritance logic:
 * 1. If office has its own logo, show office logo
 * 2. If office has no logo but company has default, show company default
 * 3. If no logos, show initials
 */
import BusinessIcon from '@mui/icons-material/Business';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import { useState, useEffect } from 'react';

import type { LogoInfo } from '../../types/office-settings';
import type { SxProps, Theme } from '@mui/material/styles';

type OfficeLogoProps = {
  /** Office's own logo (if selected from library) */
  logo: LogoInfo | null | undefined;
  /** Company's default logo (for fallback) */
  companyDefaultLogo?: LogoInfo | null;
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
  /** Whether to show inheritance badge */
  showInheritanceBadge?: boolean;
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
 * Displays an office logo with fallback to company default or initials.
 */
export function OfficeLogo({
  logo,
  companyDefaultLogo,
  officeName,
  size = 48,
  isLoading = false,
  sx,
  useThumbnail = false,
  showInheritanceBadge = false,
}: OfficeLogoProps): React.ReactElement {
  const [imageError, setImageError] = useState(false);

  // Determine which logo to display (office → company default → none)
  const displayLogo = logo ?? companyDefaultLogo ?? null;
  const isInherited = !logo && !!companyDefaultLogo;

  // Determine which URL to use
  const imageUrl =
    useThumbnail && displayLogo?.thumbnailUrl
      ? displayLogo.thumbnailUrl
      : displayLogo?.url;

  // Reset error state when logo changes
  useEffect(() => {
    setImageError(false);
  }, [displayLogo?.id]);

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
  const hasValidImage = displayLogo && imageUrl && !imageError;

  const avatarContent = hasValidImage ? (
    <Avatar
      src={imageUrl}
      alt={`${officeName} logo${isInherited ? ' (company default)' : ''}`}
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
  ) : (
    // Show initials or icon fallback
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
      {getInitials(officeName) || (
        <BusinessIcon sx={{ fontSize: size * 0.5 }} />
      )}
    </Avatar>
  );

  // Add inheritance badge if requested
  if (showInheritanceBadge && isInherited) {
    return (
      <Tooltip title="Using company default logo">
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <BusinessIcon
              sx={{
                fontSize: size * 0.35,
                bgcolor: 'background.paper',
                borderRadius: '50%',
                p: 0.25,
                color: 'text.secondary',
              }}
            />
          }
        >
          {avatarContent}
        </Badge>
      </Tooltip>
    );
  }

  return avatarContent;
}
