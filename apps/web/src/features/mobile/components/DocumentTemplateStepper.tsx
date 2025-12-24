/**
 * Document Template Stepper component.
 * Allows incrementing/decrementing the number of pages for multi-page templates.
 * Based on iOS: UIStepper in ContractPagesSelectionTableViewCell
 */
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';

import type { DocumentTemplateStepperProps } from '../types/document';
import type React from 'react';

/**
 * Stepper component for adjusting multi-page template counts.
 * Shows increment/decrement buttons with current value.
 *
 * @param props - Stepper props
 * @returns Stepper element
 */
export function DocumentTemplateStepper({
  value,
  min = 0,
  max = 99,
  onChange,
  disabled = false,
}: DocumentTemplateStepperProps): React.ReactElement {
  const handleDecrement = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (value > min) {
        onChange(value - 1);
      }
    },
    [value, min, onChange],
  );

  const handleIncrement = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (value < max) {
        onChange(value + 1);
      }
    },
    [value, max, onChange],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'primary.main',
        overflow: 'hidden',
      }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <IconButton
        size="small"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Decrease count"
        sx={{
          borderRadius: 0,
          color: 'primary.main',
          '&:disabled': {
            color: 'action.disabled',
          },
        }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>

      <Typography
        variant="body2"
        sx={{
          minWidth: 24,
          textAlign: 'center',
          fontWeight: 500,
          color: 'text.primary',
        }}
      >
        {value}
      </Typography>

      <IconButton
        size="small"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Increase count"
        sx={{
          borderRadius: 0,
          color: 'primary.main',
          '&:disabled': {
            color: 'action.disabled',
          },
        }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
