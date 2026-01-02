/**
 * UsageCountBadge - Shows how many MSIs reference this item.
 */
import BusinessIcon from '@mui/icons-material/Business';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import type { SxProps, Theme } from '@mui/material/styles';

export type UsageCountBadgeProps = {
  /** Number of MSIs using this item */
  count: number;
  /** Label type (singular/plural) */
  label?: 'MSI' | 'MSIs' | 'option' | 'options' | 'upcharge' | 'upcharges';
  /** Whether the badge is clickable */
  onClick?: () => void;
  /** Custom tooltip text */
  tooltip?: string;
  /** Custom sx props */
  sx?: SxProps<Theme>;
};

/**
 * Badge showing usage count (e.g., "Used in 12 MSIs").
 * Clickable to open "Where Used" panel.
 */
export function UsageCountBadge({
  count,
  label = 'MSIs',
  onClick,
  tooltip,
  sx,
}: UsageCountBadgeProps): React.ReactElement {
  // Determine singular/plural label
  const displayLabel = (() => {
    if (label === 'MSIs' || label === 'MSI') {
      return count === 1 ? 'MSI' : 'MSIs';
    }
    if (label === 'options' || label === 'option') {
      return count === 1 ? 'option' : 'options';
    }
    // upcharges or upcharge
    return count === 1 ? 'upcharge' : 'upcharges';
  })();

  const chipLabel = `${count} ${displayLabel}`;
  const tooltipText =
    tooltip ?? (count > 0 ? `Used in ${chipLabel}` : 'Not used anywhere');

  return (
    <Tooltip title={tooltipText} arrow>
      <Chip
        icon={<BusinessIcon sx={{ fontSize: 16 }} />}
        label={chipLabel}
        size="small"
        color={count > 0 ? 'primary' : 'default'}
        variant={count > 0 ? 'filled' : 'outlined'}
        onClick={onClick}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          ...sx,
        }}
      />
    </Tooltip>
  );
}
