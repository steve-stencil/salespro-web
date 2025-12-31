/**
 * Reusable Pricing Grid Component.
 * Displays a matrix of offices × price types for pricing configuration.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';

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
  /** Callback when bulk price change is requested for a price type */
  onBulkPriceChange?: (priceTypeId: string, amount: number) => void;
  /** Whether the grid is read-only */
  readOnly?: boolean;
  /** Optional title for the grid */
  title?: string;
  /** Optional subtitle for the grid */
  subtitle?: string;
};

// ============================================================================
// Quick Add Popover
// ============================================================================

type QuickAddPopoverProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  priceTypeName: string;
  onClose: () => void;
  onApply: (amount: number) => void;
};

function QuickAddPopover({
  open,
  anchorEl,
  priceTypeName,
  onClose,
  onApply,
}: QuickAddPopoverProps): React.ReactElement {
  const [amount, setAmount] = useState('');

  const handleApply = useCallback(() => {
    const numericAmount = parseFloat(amount) || 0;
    onApply(numericAmount);
    setAmount('');
    onClose();
  }, [amount, onApply, onClose]);

  const handleClose = useCallback(() => {
    setAmount('');
    onClose();
  }, [onClose]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Box sx={{ p: 2, minWidth: 200 }}>
        <Typography variant="subtitle2" gutterBottom>
          Set {priceTypeName} for all offices
        </Typography>
        <TextField
          fullWidth
          size="small"
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.01 }}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleApply();
            }
          }}
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleApply}>
            Apply to All
          </Button>
        </Box>
      </Box>
    </Popover>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PricingGrid({
  offices,
  priceTypes,
  pricing,
  onPriceChange,
  onBulkPriceChange,
  readOnly = false,
  title,
  subtitle,
}: PricingGridProps): React.ReactElement {
  const [quickAddAnchor, setQuickAddAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [quickAddPriceType, setQuickAddPriceType] = useState<PriceType | null>(
    null,
  );

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

  // Check if a price type is enabled for an office
  const isPriceTypeEnabledForOffice = useCallback(
    (priceType: PriceType, officeId: string): boolean => {
      return priceType.enabledOfficeIds.includes(officeId);
    },
    [],
  );

  // Handle column header click for quick add
  const handleColumnHeaderClick = useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>, priceType: PriceType) => {
      if (readOnly || !onBulkPriceChange) return;
      setQuickAddAnchor(event.currentTarget);
      setQuickAddPriceType(priceType);
    },
    [readOnly, onBulkPriceChange],
  );

  // Handle quick add close
  const handleQuickAddClose = useCallback(() => {
    setQuickAddAnchor(null);
    setQuickAddPriceType(null);
  }, []);

  // Handle quick add apply
  const handleQuickAddApply = useCallback(
    (amount: number) => {
      if (quickAddPriceType && onBulkPriceChange) {
        onBulkPriceChange(quickAddPriceType.id, amount);
      }
    },
    [quickAddPriceType, onBulkPriceChange],
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

  const showQuickAdd = !readOnly && onBulkPriceChange;

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
                  bgcolor: 'action.hover',
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
                  onClick={e => handleColumnHeaderClick(e, priceType)}
                  sx={{
                    fontWeight: 600,
                    bgcolor: 'action.hover',
                    minWidth: 120,
                    cursor: showQuickAdd ? 'pointer' : 'default',
                    '&:hover': showQuickAdd
                      ? {
                          bgcolor: 'action.selected',
                        }
                      : undefined,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 0.5,
                    }}
                  >
                    {priceType.name}
                    {showQuickAdd && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          color: 'primary.main',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        +
                      </Typography>
                    )}
                  </Box>
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
                {priceTypes.map(priceType => {
                  const isEnabled = isPriceTypeEnabledForOffice(
                    priceType,
                    office.id,
                  );
                  return (
                    <TableCell
                      key={priceType.id}
                      align="right"
                      sx={{
                        p: 0.5,
                        bgcolor: isEnabled
                          ? 'inherit'
                          : 'action.disabledBackground',
                      }}
                    >
                      {!isEnabled ? (
                        // Price type not enabled for this office - show disabled state
                        <Box
                          sx={{
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.disabled"
                            sx={{ fontStyle: 'italic' }}
                          >
                            —
                          </Typography>
                        </Box>
                      ) : readOnly ? (
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
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Quick Add Popover */}
      <QuickAddPopover
        open={Boolean(quickAddAnchor)}
        anchorEl={quickAddAnchor}
        priceTypeName={quickAddPriceType?.name ?? ''}
        onClose={handleQuickAddClose}
        onApply={handleQuickAddApply}
      />
    </Box>
  );
}
