/**
 * PricingStatusBadge - Shows pricing completeness status.
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import type { SxProps, Theme } from '@mui/material/styles';

export type PricingStatus = 'complete' | 'partial' | 'none';

export type PricingStatusBadgeProps = {
  /** Pricing completeness status */
  status: PricingStatus;
  /** Number of offices with pricing (for partial) */
  completedCount?: number;
  /** Total number of offices */
  totalCount?: number;
  /** Missing offices (for tooltip) */
  missingOffices?: string[];
  /** Custom sx props */
  sx?: SxProps<Theme>;
};

/**
 * Badge showing pricing completeness status.
 */
export function PricingStatusBadge({
  status,
  completedCount,
  totalCount,
  missingOffices,
  sx,
}: PricingStatusBadgeProps): React.ReactElement {
  const config = {
    complete: {
      icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
      label: 'Pricing OK',
      color: 'success' as const,
      tooltip: 'All offices have pricing configured',
    },
    partial: {
      icon: <WarningIcon sx={{ fontSize: 16 }} />,
      label:
        completedCount !== undefined && totalCount !== undefined
          ? `${completedCount}/${totalCount} offices`
          : 'Partial pricing',
      color: 'warning' as const,
      tooltip: missingOffices?.length
        ? `Missing pricing for: ${missingOffices.join(', ')}`
        : 'Some offices are missing pricing',
    },
    none: {
      icon: <ErrorIcon sx={{ fontSize: 16 }} />,
      label: 'No pricing',
      color: 'error' as const,
      tooltip: 'No pricing configured',
    },
  };

  const { icon, label, color, tooltip } = config[status];

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        icon={icon}
        label={label}
        size="small"
        color={color}
        variant="outlined"
        sx={sx}
      />
    </Tooltip>
  );
}
