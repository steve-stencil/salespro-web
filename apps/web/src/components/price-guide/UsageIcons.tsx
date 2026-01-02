/**
 * UsageIcons - Compact icon badges showing usage counts.
 * Displays small icons with superscript numbers for MSI and UpCharge usage.
 */
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GridViewIcon from '@mui/icons-material/GridView';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

export type UsageIconsProps = {
  /** Number of MSIs using this item */
  msiCount: number;
  /** Number of UpCharges using this item */
  upchargeCount: number;
};

type IconBadgeProps = {
  icon: React.ReactNode;
  count: number;
  color: string;
  label: string;
};

/**
 * Single icon with count badge overlay.
 */
function IconBadge({
  icon,
  count,
  color,
  label,
}: IconBadgeProps): React.ReactElement {
  return (
    <Tooltip title={`${count} ${label}${count !== 1 ? 's' : ''}`} arrow>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          color,
        }}
      >
        {icon}
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.65rem',
            fontWeight: 600,
            color,
            lineHeight: 1,
          }}
        >
          {count}
        </Typography>
      </Box>
    </Tooltip>
  );
}

/**
 * Renders compact usage count icons for MSIs and UpCharges.
 * Only shows icons for non-zero counts.
 */
export function UsageIcons({
  msiCount,
  upchargeCount,
}: UsageIconsProps): React.ReactElement | null {
  const hasMsi = msiCount > 0;
  const hasUpcharge = upchargeCount > 0;

  if (!hasMsi && !hasUpcharge) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {hasMsi && (
        <IconBadge
          icon={<GridViewIcon sx={{ fontSize: 14 }} />}
          count={msiCount}
          color="primary.main"
          label="MSI"
        />
      )}
      {hasUpcharge && (
        <IconBadge
          icon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
          count={upchargeCount}
          color="secondary.main"
          label="UpCharge"
        />
      )}
    </Box>
  );
}
