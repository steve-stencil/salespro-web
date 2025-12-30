/**
 * CompatibilityBadge - Shows upcharge option compatibility status.
 * Only renders when there are disabled options.
 */
import WarningIcon from '@mui/icons-material/Warning';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import type { SxProps, Theme } from '@mui/material/styles';

export type CompatibilityBadgeProps = {
  /** Number of options this upcharge is disabled for */
  disabledCount: number;
  /** Total number of options */
  totalCount?: number;
  /** Names of disabled options (for tooltip) */
  disabledOptions?: string[];
  /** Custom sx props */
  sx?: SxProps<Theme>;
};

/**
 * Badge showing upcharge compatibility with options.
 * Returns null if the upcharge works with all options (no disabled options).
 */
export function CompatibilityBadge({
  disabledCount,
  totalCount: _totalCount,
  disabledOptions,
  sx,
}: CompatibilityBadgeProps): React.ReactElement | null {
  // Don't show badge if upcharge works with all options
  if (disabledCount === 0) {
    return null;
  }

  const label = `${disabledCount} disabled`;

  const tooltip = disabledOptions?.length
    ? `Disabled for: ${disabledOptions.slice(0, 5).join(', ')}${
        disabledOptions.length > 5
          ? ` and ${disabledOptions.length - 5} more`
          : ''
      }`
    : `Disabled for ${disabledCount} option${disabledCount !== 1 ? 's' : ''}`;

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        icon={<WarningIcon sx={{ fontSize: 16 }} />}
        label={label}
        size="small"
        color="warning"
        variant="outlined"
        sx={sx}
      />
    </Tooltip>
  );
}
