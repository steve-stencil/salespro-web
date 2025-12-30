/**
 * Override Pricing Grid Component.
 * Compact table view for configuring per-office, per-price-type overrides.
 * Similar to PricingGrid but with mode selection (Fixed/Percentage/Use Default).
 */

import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo } from 'react';

import type {
  UpChargeOverrideMode,
  PriceType,
  UpChargePriceTypeConfig,
} from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type Office = {
  id: string;
  name: string;
};

/** Office-level override config */
export type OfficeOverrideConfig = {
  mode: UpChargeOverrideMode;
  fixedAmount?: number;
  percentageRate?: number;
  percentageBaseTypeIds?: string[];
};

/** Grid data structure: priceTypeId -> officeId -> config */
export type OverrideGridData = Record<
  string,
  Record<string, OfficeOverrideConfig>
>;

type OverridePricingGridProps = {
  /** Available offices */
  offices: Office[];
  /** Available price types */
  priceTypes: PriceType[];
  /** Current override data */
  data: OverrideGridData;
  /** Callback when data changes */
  onChange: (data: OverrideGridData) => void;
  /** Default configs for reference display */
  defaultConfigs: UpChargePriceTypeConfig[];
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Sample parent option prices for percentage calculation (priceTypeId -> amount) */
  samplePrices?: Record<string, number>;
};

// ============================================================================
// Helper: Calculate percentage amount
// ============================================================================

function calculatePercentageAmount(
  rate: number,
  baseTypeIds: string[],
  samplePrices?: Record<string, number>,
): number {
  if (!samplePrices || baseTypeIds.length === 0) return 0;
  const baseSum = baseTypeIds.reduce(
    (sum, id) => sum + (samplePrices[id] ?? 0),
    0,
  );
  return rate * baseSum;
}

// ============================================================================
// Cell Display Component
// ============================================================================

type CellDisplayProps = {
  config: OfficeOverrideConfig;
  priceTypes: PriceType[];
  defaultConfig?: UpChargePriceTypeConfig;
  office: Office;
  samplePrices?: Record<string, number>;
  isCustom: boolean;
};

function CellDisplay({
  config,
  priceTypes: _priceTypes,
  defaultConfig,
  office,
  samplePrices,
  isCustom,
}: CellDisplayProps): React.ReactElement {
  // Calculate the effective amount to display
  const getDisplayAmount = (): {
    amount: number;
    isPercentage: boolean;
    rate?: number;
  } => {
    if (config.mode === 'use_default') {
      if (!defaultConfig) return { amount: 0, isPercentage: false };

      if (defaultConfig.mode === 'fixed') {
        return {
          amount: defaultConfig.fixedAmounts?.[office.id] ?? 0,
          isPercentage: false,
        };
      }

      // percentage mode
      const rate = defaultConfig.percentageRate ?? 0;
      const baseIds = defaultConfig.percentageBaseTypeIds ?? [];
      const calculatedAmount = calculatePercentageAmount(
        rate,
        baseIds,
        samplePrices,
      );
      return { amount: calculatedAmount, isPercentage: true, rate };
    }

    if (config.mode === 'fixed') {
      return { amount: config.fixedAmount ?? 0, isPercentage: false };
    }

    // percentage mode
    const rate = config.percentageRate ?? 0;
    const baseIds = config.percentageBaseTypeIds ?? [];
    const calculatedAmount = calculatePercentageAmount(
      rate,
      baseIds,
      samplePrices,
    );
    return { amount: calculatedAmount, isPercentage: true, rate };
  };

  const { amount, isPercentage, rate } = getDisplayAmount();

  // Custom overrides show with a chip
  if (isCustom) {
    if (isPercentage && rate !== undefined) {
      return (
        <Chip
          label={`$${amount.toFixed(2)} (${(rate * 100).toFixed(0)}%)`}
          size="small"
          color="secondary"
          variant="outlined"
        />
      );
    }
    return (
      <Chip
        label={`$${amount.toFixed(2)}`}
        size="small"
        color="primary"
        variant="outlined"
      />
    );
  }

  // Default values show as plain text
  if (isPercentage && rate !== undefined) {
    return (
      <Typography variant="body2" color="text.secondary">
        ${amount.toFixed(2)}
        <Typography
          component="span"
          variant="caption"
          color="text.disabled"
          sx={{ ml: 0.5 }}
        >
          ({(rate * 100).toFixed(0)}%)
        </Typography>
      </Typography>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">
      ${amount.toFixed(2)}
    </Typography>
  );
}

// ============================================================================
// Cell Editor Component
// ============================================================================

type CellEditorProps = {
  config: OfficeOverrideConfig;
  priceTypes: PriceType[];
  onChange: (config: OfficeOverrideConfig) => void;
  onClose: () => void;
  samplePrices?: Record<string, number>;
};

function CellEditor({
  config,
  priceTypes,
  onChange,
  onClose,
  samplePrices,
}: CellEditorProps): React.ReactElement {
  const [mode, setMode] = useState<UpChargeOverrideMode>(config.mode);
  const [fixedAmount, setFixedAmount] = useState(config.fixedAmount ?? 0);
  const [percentageRate, setPercentageRate] = useState(
    (config.percentageRate ?? 0.1) * 100,
  );
  const [baseTypeIds, setBaseTypeIds] = useState<string[]>(
    config.percentageBaseTypeIds ?? priceTypes.slice(0, 2).map(pt => pt.id),
  );

  // Calculate preview amount for percentage
  const previewAmount = useMemo(() => {
    if (mode !== 'percentage') return 0;
    return calculatePercentageAmount(
      percentageRate / 100,
      baseTypeIds,
      samplePrices,
    );
  }, [mode, percentageRate, baseTypeIds, samplePrices]);

  const handleSave = useCallback(() => {
    let newConfig: OfficeOverrideConfig;

    if (mode === 'use_default') {
      newConfig = { mode: 'use_default' };
    } else if (mode === 'fixed') {
      newConfig = { mode: 'fixed', fixedAmount };
    } else {
      newConfig = {
        mode: 'percentage',
        percentageRate: percentageRate / 100,
        percentageBaseTypeIds: baseTypeIds,
      };
    }

    onChange(newConfig);
    onClose();
  }, [mode, fixedAmount, percentageRate, baseTypeIds, onChange, onClose]);

  const activePriceTypes = priceTypes.filter(pt => pt.isActive);

  return (
    <Box sx={{ p: 2, minWidth: 280 }}>
      <Typography variant="subtitle2" gutterBottom>
        Override Mode
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <Select
          value={mode}
          onChange={e => setMode(e.target.value as UpChargeOverrideMode)}
        >
          <MenuItem value="use_default">Use Default</MenuItem>
          <MenuItem value="fixed">Fixed Amount</MenuItem>
          <MenuItem value="percentage">Percentage</MenuItem>
        </Select>
      </FormControl>

      {mode === 'fixed' && (
        <TextField
          label="Amount"
          type="number"
          size="small"
          fullWidth
          value={fixedAmount || ''}
          onChange={e => setFixedAmount(parseFloat(e.target.value) || 0)}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.01 }}
          sx={{ mb: 2 }}
        />
      )}

      {mode === 'percentage' && (
        <>
          <TextField
            label="Rate"
            type="number"
            size="small"
            fullWidth
            value={percentageRate || ''}
            onChange={e => setPercentageRate(parseFloat(e.target.value) || 0)}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            sx={{ mb: 2 }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
            gutterBottom
            display="block"
          >
            Calculate % of:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {activePriceTypes.map(pt => (
              <Chip
                key={pt.id}
                label={pt.code}
                size="small"
                color={baseTypeIds.includes(pt.id) ? 'primary' : 'default'}
                onClick={() => {
                  if (baseTypeIds.includes(pt.id)) {
                    setBaseTypeIds(baseTypeIds.filter(id => id !== pt.id));
                  } else {
                    setBaseTypeIds([...baseTypeIds, pt.id]);
                  }
                }}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {samplePrices ? (
              <>
                Preview: <strong>${previewAmount.toFixed(2)}</strong>
              </>
            ) : (
              <em>Set option pricing to see preview</em>
            )}
          </Typography>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="primary" onClick={handleSave}>
          <CheckIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OverridePricingGrid({
  offices,
  priceTypes,
  data,
  onChange,
  defaultConfigs,
  disabled = false,
  samplePrices,
}: OverridePricingGridProps): React.ReactElement {
  const [editingCell, setEditingCell] = useState<{
    priceTypeId: string;
    officeId: string;
    anchorEl: HTMLElement;
  } | null>(null);

  // State for bulk editing a column (quick add)
  const [bulkEditColumn, setBulkEditColumn] = useState<{
    priceTypeId: string;
    anchorEl: HTMLElement;
  } | null>(null);
  const [bulkMode, setBulkMode] = useState<UpChargeOverrideMode>('fixed');
  const [bulkAmount, setBulkAmount] = useState<string>('');
  const [bulkRate, setBulkRate] = useState<string>('10');
  const [bulkBases, setBulkBases] = useState<string[]>([]);

  const activePriceTypes = priceTypes.filter(pt => pt.isActive);

  const handleCellClick = useCallback(
    (
      priceTypeId: string,
      officeId: string,
      event: React.MouseEvent<HTMLElement>,
    ) => {
      if (disabled) return;
      setEditingCell({ priceTypeId, officeId, anchorEl: event.currentTarget });
    },
    [disabled],
  );

  const handleCellChange = useCallback(
    (priceTypeId: string, officeId: string, config: OfficeOverrideConfig) => {
      const newData = { ...data };
      newData[priceTypeId] ??= {};
      newData[priceTypeId] = {
        ...newData[priceTypeId],
        [officeId]: config,
      };
      onChange(newData);
    },
    [data, onChange],
  );

  // Handle column header click for bulk edit
  const handleColumnHeaderClick = useCallback(
    (priceTypeId: string, event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      event.stopPropagation();
      // Initialize bulk edit state
      setBulkMode('fixed');
      setBulkAmount('');
      setBulkRate('10');
      setBulkBases(activePriceTypes.slice(0, 2).map(pt => pt.id));
      setBulkEditColumn({ priceTypeId, anchorEl: event.currentTarget });
    },
    [disabled, activePriceTypes],
  );

  // Apply bulk settings to all offices for a price type
  const handleBulkApply = useCallback(() => {
    if (!bulkEditColumn) return;
    const newData = { ...data };
    newData[bulkEditColumn.priceTypeId] ??= {};

    for (const office of offices) {
      if (bulkMode === 'fixed') {
        const amount = parseFloat(bulkAmount) || 0;
        newData[bulkEditColumn.priceTypeId][office.id] = {
          mode: 'fixed',
          fixedAmount: amount,
        };
      } else if (bulkMode === 'percentage') {
        const rate = (parseFloat(bulkRate) || 10) / 100;
        newData[bulkEditColumn.priceTypeId][office.id] = {
          mode: 'percentage',
          percentageRate: rate,
          percentageBaseTypeIds:
            bulkBases.length > 0
              ? bulkBases
              : activePriceTypes.slice(0, 2).map(pt => pt.id),
        };
      } else {
        // use_default
        newData[bulkEditColumn.priceTypeId][office.id] = {
          mode: 'use_default',
        };
      }
    }

    onChange(newData);
    setBulkEditColumn(null);
    setBulkAmount('');
    setBulkRate('10');
    setBulkBases([]);
  }, [
    bulkEditColumn,
    bulkMode,
    bulkAmount,
    bulkRate,
    bulkBases,
    data,
    offices,
    onChange,
    activePriceTypes,
  ]);

  const getConfig = (
    priceTypeId: string,
    officeId: string,
  ): OfficeOverrideConfig => {
    return data[priceTypeId]?.[officeId] ?? { mode: 'use_default' };
  };

  const getDefaultConfig = (
    priceTypeId: string,
  ): UpChargePriceTypeConfig | undefined => {
    return defaultConfigs.find(c => c.priceTypeId === priceTypeId);
  };

  // Count custom overrides
  const customCount = Object.values(data).reduce((total, priceTypeData) => {
    return (
      total +
      Object.values(priceTypeData).filter(c => c.mode !== 'use_default').length
    );
  }, 0);

  return (
    <Box>
      {customCount > 0 && (
        <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${customCount} custom override${customCount > 1 ? 's' : ''}`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Button
            size="small"
            onClick={() => {
              // Reset all to default
              const resetData: OverrideGridData = {};
              for (const pt of activePriceTypes) {
                resetData[pt.id] = {};
                for (const office of offices) {
                  resetData[pt.id][office.id] = { mode: 'use_default' };
                }
              }
              onChange(resetData);
            }}
          >
            Reset All
          </Button>
        </Box>
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
                  minWidth: 120,
                }}
              >
                Office
              </TableCell>
              {activePriceTypes.map(pt => (
                <TableCell
                  key={pt.id}
                  align="center"
                  onClick={e => handleColumnHeaderClick(pt.id, e)}
                  sx={{
                    fontWeight: 600,
                    bgcolor: 'action.hover',
                    minWidth: 100,
                    cursor: disabled ? 'default' : 'pointer',
                    '&:hover': disabled
                      ? {}
                      : {
                          bgcolor: 'action.selected',
                        },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                    }}
                  >
                    {pt.name}
                    {!disabled && (
                      <Typography
                        variant="caption"
                        color="primary.main"
                        sx={{ fontSize: '0.65rem' }}
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
                {activePriceTypes.map(pt => {
                  const config = getConfig(pt.id, office.id);
                  const defaultConfig = getDefaultConfig(pt.id);
                  const isCustom = config.mode !== 'use_default';

                  return (
                    <TableCell
                      key={pt.id}
                      align="center"
                      onClick={e => handleCellClick(pt.id, office.id, e)}
                      sx={{
                        cursor: disabled ? 'default' : 'pointer',
                        '&:hover': disabled
                          ? {}
                          : {
                              bgcolor: 'action.hover',
                            },
                        py: 1,
                      }}
                    >
                      <CellDisplay
                        config={config}
                        priceTypes={priceTypes}
                        defaultConfig={defaultConfig}
                        office={office}
                        samplePrices={samplePrices}
                        isCustom={isCustom}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Popover */}
      <Popover
        open={editingCell !== null}
        anchorEl={editingCell?.anchorEl}
        onClose={() => setEditingCell(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        {editingCell && (
          <CellEditor
            config={getConfig(editingCell.priceTypeId, editingCell.officeId)}
            priceTypes={priceTypes}
            onChange={config =>
              handleCellChange(
                editingCell.priceTypeId,
                editingCell.officeId,
                config,
              )
            }
            onClose={() => setEditingCell(null)}
            samplePrices={samplePrices}
          />
        )}
      </Popover>

      {/* Bulk Edit Popover (Quick Add) */}
      <Popover
        open={bulkEditColumn !== null}
        anchorEl={bulkEditColumn?.anchorEl}
        onClose={() => setBulkEditColumn(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, minWidth: 280 }}>
          <Typography variant="subtitle2" gutterBottom>
            Set{' '}
            {
              activePriceTypes.find(pt => pt.id === bulkEditColumn?.priceTypeId)
                ?.name
            }{' '}
            for all offices
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={bulkMode}
              onChange={e =>
                setBulkMode(e.target.value as UpChargeOverrideMode)
              }
            >
              <MenuItem value="use_default">Use Default</MenuItem>
              <MenuItem value="fixed">Fixed Amount</MenuItem>
              <MenuItem value="percentage">Percentage</MenuItem>
            </Select>
          </FormControl>

          {bulkMode === 'fixed' && (
            <TextField
              label="Amount"
              type="number"
              size="small"
              fullWidth
              autoFocus
              value={bulkAmount}
              onChange={e => setBulkAmount(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleBulkApply();
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ mb: 2 }}
            />
          )}

          {bulkMode === 'percentage' && (
            <>
              <TextField
                label="Rate"
                type="number"
                size="small"
                fullWidth
                autoFocus
                value={bulkRate}
                onChange={e => setBulkRate(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleBulkApply();
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                sx={{ mb: 2 }}
              />

              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
                display="block"
              >
                Calculate % of:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {activePriceTypes.map(pt => (
                  <Chip
                    key={pt.id}
                    label={pt.code}
                    size="small"
                    color={bulkBases.includes(pt.id) ? 'primary' : 'default'}
                    onClick={() => {
                      if (bulkBases.includes(pt.id)) {
                        setBulkBases(bulkBases.filter(id => id !== pt.id));
                      } else {
                        setBulkBases([...bulkBases, pt.id]);
                      }
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" onClick={() => setBulkEditColumn(null)}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleBulkApply}>
              Apply to All
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
