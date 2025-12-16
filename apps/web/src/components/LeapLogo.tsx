/**
 * Leap logo component.
 * Displays the official Leap brand logo with frog icon.
 * Per trademark requirements, the frog icon MUST appear alongside "Leap" text.
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { FrogIcon } from './FrogIcon';

type LeapLogoProps = {
  /**
   * Size variant for the logo.
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Color variant - uses theme primary color by default.
   * @default 'primary'
   */
  color?: 'primary' | 'white';
  /**
   * Whether to show the trademark symbol.
   * @default true
   */
  showTrademark?: boolean;
};

const sizeConfig = {
  small: { fontSize: '1.25rem', iconSize: 28, tmFontSize: 5, tmTop: 3 },
  medium: { fontSize: '1.5rem', iconSize: 40, tmFontSize: 6, tmTop: 5 },
  large: { fontSize: '2rem', iconSize: 56, tmFontSize: 8, tmTop: 6 },
};

/**
 * Official Leap brand logo with frog icon and text.
 * The frog icon is part of the registered trademark "[FROG] Leap".
 */
export function LeapLogo({
  size = 'medium',
  color = 'primary',
  showTrademark = true,
}: LeapLogoProps): React.ReactElement {
  const config = sizeConfig[size];
  const frogColor = color === 'white' ? '#FFFFFF' : '#26D07C';
  const textColor = color === 'white' ? '#FFFFFF' : 'text.primary';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
      }}
      aria-label="Leap logo"
    >
      {/* Official Leap frog icon - required per trademark */}
      <FrogIcon color={frogColor} size={config.iconSize} />

      {/* "Leap" text */}
      <Typography
        component="span"
        sx={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 600,
          fontSize: config.fontSize,
          color: textColor,
          lineHeight: 1,
          mt: '11px',
        }}
      >
        Leap
      </Typography>

      {/* Trademark symbol */}
      {showTrademark && (
        <Typography
          component="span"
          sx={{
            fontSize: config.tmFontSize,
            position: 'relative',
            top: config.tmTop,
            left: -2,
            color: textColor,
          }}
        >
          TM
        </Typography>
      )}
    </Box>
  );
}
