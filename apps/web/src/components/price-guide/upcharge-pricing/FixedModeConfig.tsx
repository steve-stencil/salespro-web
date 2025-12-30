/**
 * Fixed Mode Configuration Component.
 * Allows setting fixed dollar amounts per office for a price type.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type Office = {
  id: string;
  name: string;
};

type FixedModeConfigProps = {
  /** List of offices */
  offices: Office[];
  /** Current amounts keyed by officeId */
  amounts: Record<string, number>;
  /** Callback when amounts change */
  onChange: (amounts: Record<string, number>) => void;
  /** Disable editing */
  disabled?: boolean;
};

// ============================================================================
// Component
// ============================================================================

export function FixedModeConfig({
  offices,
  amounts,
  onChange,
  disabled = false,
}: FixedModeConfigProps): React.ReactElement {
  const [fillValue, setFillValue] = useState('');

  const handleAmountChange = useCallback(
    (officeId: string, value: string) => {
      const numValue = value === '' ? 0 : parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        onChange({
          ...amounts,
          [officeId]: numValue,
        });
      }
    },
    [amounts, onChange],
  );

  const handleFillAll = useCallback(() => {
    const numValue = parseFloat(fillValue);
    if (!isNaN(numValue) && numValue >= 0) {
      const newAmounts: Record<string, number> = {};
      for (const office of offices) {
        newAmounts[office.id] = numValue;
      }
      onChange(newAmounts);
      setFillValue('');
    }
  }, [fillValue, offices, onChange]);

  const formatAmount = (value: number | undefined): string => {
    if (value === undefined || value === 0) return '';
    return value.toString();
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Set fixed amounts per office:
      </Typography>

      <Stack spacing={1.5}>
        {offices.map(office => (
          <Box
            key={office.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                width: 120,
                flexShrink: 0,
                fontWeight: 500,
              }}
            >
              {office.name}
            </Typography>
            <TextField
              size="small"
              type="number"
              disabled={disabled}
              value={formatAmount(amounts[office.id])}
              onChange={e => handleAmountChange(office.id, e.target.value)}
              placeholder="0.00"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
              inputProps={{
                min: 0,
                step: 0.01,
                style: { textAlign: 'right' },
              }}
              sx={{ width: 140 }}
            />
          </Box>
        ))}
      </Stack>

      {/* Quick Fill */}
      {!disabled && offices.length > 1 && (
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Quick fill:
          </Typography>
          <TextField
            size="small"
            type="number"
            value={fillValue}
            onChange={e => setFillValue(e.target.value)}
            placeholder="0.00"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              ),
            }}
            inputProps={{
              min: 0,
              step: 0.01,
              style: { textAlign: 'right' },
            }}
            sx={{ width: 120 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={handleFillAll}
            disabled={!fillValue}
          >
            Apply to All
          </Button>
        </Box>
      )}
    </Box>
  );
}
