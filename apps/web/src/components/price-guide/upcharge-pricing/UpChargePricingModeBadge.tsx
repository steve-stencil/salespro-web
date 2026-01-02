/**
 * UpCharge Pricing Mode Badge Component.
 * Displays the pricing mode summary (All Fixed, All %, Mixed) for an upcharge.
 */

import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import type { UpChargeModeDisplay } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type UpChargePricingModeBadgeProps = {
  /** The display mode to show */
  mode: UpChargeModeDisplay;
  /** Size of the badge */
  size?: 'small' | 'medium';
};

// ============================================================================
// Component
// ============================================================================

export function UpChargePricingModeBadge({
  mode,
  size = 'small',
}: UpChargePricingModeBadgeProps): React.ReactElement {
  switch (mode.type) {
    case 'all_fixed':
      return (
        <Tooltip title="All price types use fixed dollar amounts">
          <Chip
            label="All Fixed"
            size={size}
            variant="outlined"
            color="default"
          />
        </Tooltip>
      );

    case 'all_percentage':
      return (
        <Tooltip
          title={`All price types use ${mode.rate}% of ${mode.baseTypes.join('+')}`}
        >
          <Chip
            label={`All ${mode.rate}% ${mode.baseTypes.join('+')}`}
            size={size}
            variant="outlined"
            color="primary"
          />
        </Tooltip>
      );

    case 'mixed':
      return (
        <Tooltip title="Different price types use different modes">
          <Chip label="Mixed" size={size} variant="filled" color="secondary" />
        </Tooltip>
      );

    case 'none':
    default:
      return (
        <Tooltip title="No pricing configured">
          <Chip
            label="Not Set"
            size={size}
            variant="outlined"
            color="warning"
          />
        </Tooltip>
      );
  }
}

