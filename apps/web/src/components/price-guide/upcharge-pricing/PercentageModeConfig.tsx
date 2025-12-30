/**
 * Percentage Mode Configuration Component.
 * Allows configuring percentage rate and base types for percentage pricing.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useMemo } from 'react';

import type { PriceType } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type PercentageModeConfigProps = {
  /** Available price types to select as base */
  priceTypes: PriceType[];
  /** Current percentage rate as decimal (e.g., 0.10 = 10%) */
  rate: number;
  /** Currently selected base type IDs */
  baseTypeIds: string[];
  /** Callback when rate changes */
  onRateChange: (rate: number) => void;
  /** Callback when base types change */
  onBaseTypesChange: (baseTypeIds: string[]) => void;
  /** Disable editing */
  disabled?: boolean;
  /** Sample option prices for preview */
  samplePrices?: Record<string, number>;
};

// ============================================================================
// Component
// ============================================================================

export function PercentageModeConfig({
  priceTypes,
  rate,
  baseTypeIds,
  onRateChange,
  onBaseTypesChange,
  disabled = false,
  samplePrices,
}: PercentageModeConfigProps): React.ReactElement {
  // Get all active price types as available bases
  // For upcharge pricing, the percentage is based on the parent option's prices,
  // so all price types are valid bases (no self-reference issue)
  const availableBaseTypes = useMemo(
    () => priceTypes.filter(pt => pt.isActive),
    [priceTypes],
  );

  const handleRateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value === '') {
        onRateChange(0);
        return;
      }
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        onRateChange(numValue / 100); // Convert to decimal
      }
    },
    [onRateChange],
  );

  const handleBaseTypeToggle = useCallback(
    (priceTypeId: string) => {
      if (baseTypeIds.includes(priceTypeId)) {
        onBaseTypesChange(baseTypeIds.filter(id => id !== priceTypeId));
      } else {
        onBaseTypesChange([...baseTypeIds, priceTypeId]);
      }
    },
    [baseTypeIds, onBaseTypesChange],
  );

  // Calculate preview if sample prices provided
  const preview = useMemo(() => {
    if (!samplePrices || baseTypeIds.length === 0) return null;
    const baseSum = baseTypeIds.reduce(
      (sum, id) => sum + (samplePrices[id] ?? 0),
      0,
    );
    return {
      baseSum,
      result: baseSum * rate,
    };
  }, [samplePrices, baseTypeIds, rate]);

  const hasError = baseTypeIds.length === 0;
  const displayRate = rate * 100;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        This price type is calculated as a percentage of the parent option.
      </Typography>

      {/* Rate Input */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="body2">Percentage rate:</Typography>
        <TextField
          size="small"
          type="number"
          disabled={disabled}
          value={displayRate === 0 ? '' : displayRate}
          onChange={handleRateChange}
          placeholder="10"
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
          inputProps={{
            min: 0,
            max: 100,
            step: 0.01,
            style: { textAlign: 'right', width: 60 },
          }}
          sx={{ width: 100 }}
        />
      </Box>

      {/* Base Type Selection */}
      <Typography variant="body2" sx={{ mb: 1 }}>
        Calculate percentage of these parent option price types:
      </Typography>
      <FormGroup sx={{ pl: 1 }}>
        {availableBaseTypes.map(pt => (
          <FormControlLabel
            key={pt.id}
            control={
              <Checkbox
                size="small"
                checked={baseTypeIds.includes(pt.id)}
                onChange={() => handleBaseTypeToggle(pt.id)}
                disabled={disabled}
              />
            }
            label={
              <Box>
                <Typography variant="body2" component="span">
                  {pt.name}
                </Typography>
                {!baseTypeIds.includes(pt.id) && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="span"
                    sx={{ ml: 1 }}
                  >
                    (not included)
                  </Typography>
                )}
              </Box>
            }
          />
        ))}
      </FormGroup>

      {/* Validation Error */}
      {hasError && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Select at least one price type for the percentage base
        </Alert>
      )}

      {/* Preview */}
      {preview && !hasError && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Preview:
          </Typography>
          <Typography variant="body2">
            {displayRate}% × ${preview.baseSum.toFixed(2)} ={' '}
            <strong>${preview.result.toFixed(2)}</strong>
          </Typography>
        </Box>
      )}
    </Box>
  );
}
