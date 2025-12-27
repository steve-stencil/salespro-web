/**
 * Reusable Pricing Grid Component.
 * Displays a matrix of offices × price types for pricing configuration.
 */

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';

import type { PriceType } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

export type Office = {
  id: string;
  name: string;
};

export type PricingData = Record<string, Record<string, number>>;

type PricingGridProps = {
  /** List of offices to display as rows */
  offices: Office[];
  /** List of price types to display as columns */
  priceTypes: PriceType[];
  /** Current pricing data: officeId -> priceTypeId -> amount */
  pricing: PricingData;
  /** Callback when a price changes */
  onPriceChange: (
    officeId: string,
    priceTypeId: string,
    amount: number,
  ) => void;
  /** Whether the grid is read-only */
  readOnly?: boolean;
  /** Optional title for the grid */
  title?: string;
  /** Optional subtitle for the grid */
  subtitle?: string;
};

// ============================================================================
// Main Component
// ============================================================================

export function PricingGrid({
  offices,
  priceTypes,
  pricing,
  onPriceChange,
  readOnly = false,
  title,
  subtitle,
}: PricingGridProps): React.ReactElement {
  // Handler for price changes
  const handlePriceChange = useCallback(
    (officeId: string, priceTypeId: string, value: string) => {
      const numericValue = value === '' ? 0 : parseFloat(value);
      if (!isNaN(numericValue) && numericValue >= 0) {
        onPriceChange(officeId, priceTypeId, numericValue);
      }
    },
    [onPriceChange],
  );

  // Get price value for display
  const getPriceValue = useCallback(
    (officeId: string, priceTypeId: string): string => {
      const officeData = pricing[officeId];
      if (!officeData) return '';
      const value = officeData[priceTypeId];
      if (value === undefined || value === 0) return '';
      return value.toString();
    },
    [pricing],
  );

  if (offices.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">No offices to display.</Typography>
      </Box>
    );
  }

  if (priceTypes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No price types configured.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: 'grey.100',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  minWidth: 150,
                }}
              >
                Office
              </TableCell>
              {priceTypes.map(priceType => (
                <TableCell
                  key={priceType.id}
                  align="right"
                  sx={{ fontWeight: 600, bgcolor: 'grey.100', minWidth: 120 }}
                >
                  {priceType.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {offices.map(office => (
              <TableRow key={office.id} hover>
                <TableCell
                  sx={{
                    fontWeight: 500,
                    position: 'sticky',
                    left: 0,
                    bgcolor: 'background.paper',
                    zIndex: 1,
                  }}
                >
                  {office.name}
                </TableCell>
                {priceTypes.map(priceType => (
                  <TableCell key={priceType.id} align="right" sx={{ p: 0.5 }}>
                    {readOnly ? (
                      <Typography variant="body2">
                        {getPriceValue(office.id, priceType.id) || '—'}
                      </Typography>
                    ) : (
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{
                          min: 0,
                          step: 0.01,
                          style: { textAlign: 'right' },
                        }}
                        value={getPriceValue(office.id, priceType.id)}
                        onChange={e =>
                          handlePriceChange(
                            office.id,
                            priceType.id,
                            e.target.value,
                          )
                        }
                        placeholder="0.00"
                        sx={{
                          width: '100%',
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': { borderColor: 'divider' },
                          },
                        }}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
