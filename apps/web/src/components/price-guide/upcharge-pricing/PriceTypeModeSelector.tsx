/**
 * Price Type Mode Selector Component.
 * Dropdown to select pricing mode (Fixed, Percentage, Not Used) for a price type.
 */

import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useCallback } from 'react';

import type {
  UpChargePriceTypeMode,
  UpChargeOverrideMode,
} from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type PriceTypeModeSelectorProps = {
  /** Current selected mode */
  value: UpChargePriceTypeMode;
  /** Callback when mode changes */
  onChange: (mode: UpChargePriceTypeMode) => void;
  /** Disable the selector */
  disabled?: boolean;
  /** Size of the selector */
  size?: 'small' | 'medium';
  /** Whether this is an override selector (includes "Use Default" option) */
  isOverride?: false;
};

type OverrideModeSelectorProps = {
  /** Current selected mode */
  value: UpChargeOverrideMode;
  /** Callback when mode changes */
  onChange: (mode: UpChargeOverrideMode) => void;
  /** Disable the selector */
  disabled?: boolean;
  /** Size of the selector */
  size?: 'small' | 'medium';
  /** Whether this is an override selector (includes "Use Default" option) */
  isOverride: true;
};

type Props = PriceTypeModeSelectorProps | OverrideModeSelectorProps;

// ============================================================================
// Constants
// ============================================================================

const MODE_OPTIONS: Array<{
  value: UpChargePriceTypeMode;
  label: string;
  description: string;
}> = [
  {
    value: 'fixed',
    label: 'Fixed',
    description: 'Set specific dollar amounts per office',
  },
  {
    value: 'percentage',
    label: 'Percentage',
    description: 'Calculate as % of parent option',
  },
];

const OVERRIDE_MODE_OPTIONS: Array<{
  value: UpChargeOverrideMode;
  label: string;
  description: string;
}> = [
  {
    value: 'fixed',
    label: 'Fixed',
    description: 'Set specific dollar amounts per office',
  },
  {
    value: 'percentage',
    label: 'Percentage',
    description: 'Calculate as % of parent option',
  },
  {
    value: 'use_default',
    label: 'Use Default',
    description: 'Inherit from default pricing',
  },
];

// ============================================================================
// Component
// ============================================================================

export function PriceTypeModeSelector(props: Props): React.ReactElement {
  const {
    value,
    onChange,
    disabled = false,
    size = 'small',
    isOverride,
  } = props;

  const options = isOverride ? OVERRIDE_MODE_OPTIONS : MODE_OPTIONS;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isOverride) {
        (onChange as (mode: UpChargeOverrideMode) => void)(
          event.target.value as UpChargeOverrideMode,
        );
      } else {
        (onChange as (mode: UpChargePriceTypeMode) => void)(
          event.target.value as UpChargePriceTypeMode,
        );
      }
    },
    [onChange, isOverride],
  );

  return (
    <TextField
      select
      size={size}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      sx={{ minWidth: 140 }}
      SelectProps={{
        MenuProps: {
          PaperProps: {
            sx: { maxWidth: 280 },
          },
        },
      }}
    >
      {options.map(option => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
