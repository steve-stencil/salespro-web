/**
 * Default Pricing Grid Component.
 * Grid-based UI for configuring default upcharge pricing (Fixed or Percentage per price type).
 * Matches the OverridePricingGrid UI style.
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
  UpChargePriceTypeMode,
  UpChargePriceTypeConfig,
  PriceType,
} from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type Office = {
  id: string;
  name: string;
};

type DefaultPricingGridProps = {
  /** Available offices */
  offices: Office[];
  /** Available price types */
  priceTypes: PriceType[];
  /** Current pricing configurations per price type */
  configs: UpChargePriceTypeConfig[];
  /** Callback when configs change */
  onChange: (configs: UpChargePriceTypeConfig[]) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Sample prices for percentage calculation preview */
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
  config: UpChargePriceTypeConfig;
  office: Office;
  samplePrices?: Record<string, number>;
  isDisabled?: boolean;
};

function CellDisplay({
  config,
  office,
  samplePrices,
  isDisabled = false,
}: CellDisplayProps): React.ReactElement {
  // Show disabled state for offices where price type is not enabled
  if (isDisabled) {
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    );
  }

  if (config.mode === 'fixed') {
    const amount = config.fixedAmounts?.[office.id] ?? 0;
    return <Typography variant="body2">${amount.toFixed(2)}</Typography>;
  }

  // Percentage mode - same for all offices
  const rate = config.percentageRate ?? 0;
  const baseIds = config.percentageBaseTypeIds ?? [];
  const calculatedAmount = calculatePercentageAmount(
    rate,
    baseIds,
    samplePrices,
  );

  if (samplePrices && calculatedAmount > 0) {
    return (
      <Typography variant="body2">
        ${calculatedAmount.toFixed(2)}
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ ml: 0.5 }}
        >
          ({(rate * 100).toFixed(0)}%)
        </Typography>
      </Typography>
    );
  }

  return <Typography variant="body2">{(rate * 100).toFixed(0)}%</Typography>;
}

// ============================================================================
// Cell Editor Component
// ============================================================================

type CellEditorProps = {
  config: UpChargePriceTypeConfig;
  office: Office;
  priceTypes: PriceType[];
  onFixedAmountChange: (officeId: string, amount: number) => void;
  onModeChange: (mode: UpChargePriceTypeMode) => void;
  onPercentageRateChange: (rate: number) => void;
  onPercentageBasesChange: (baseIds: string[]) => void;
  onClose: () => void;
  samplePrices?: Record<string, number>;
};

function CellEditor({
  config,
  office,
  priceTypes,
  onFixedAmountChange,
  onModeChange,
  onPercentageRateChange,
  onPercentageBasesChange,
  onClose,
  samplePrices,
}: CellEditorProps): React.ReactElement {
  const [localAmount, setLocalAmount] = useState(
    config.mode === 'fixed' ? (config.fixedAmounts?.[office.id] ?? 0) : 0,
  );
  const [localRate, setLocalRate] = useState(
    (config.percentageRate ?? 0.1) * 100,
  );
  const [localBases, setLocalBases] = useState<string[]>(
    config.percentageBaseTypeIds ??
      priceTypes
        .filter(pt => pt.isActive)
        .slice(0, 2)
        .map(pt => pt.id),
  );

  const activePriceTypes = priceTypes.filter(pt => pt.isActive);

  // Calculate preview for percentage
  const previewAmount = useMemo(() => {
    return calculatePercentageAmount(localRate / 100, localBases, samplePrices);
  }, [localRate, localBases, samplePrices]);

  const handleSave = useCallback(() => {
    if (config.mode === 'fixed') {
      onFixedAmountChange(office.id, localAmount);
    } else {
      onPercentageRateChange(localRate / 100);
      onPercentageBasesChange(localBases);
    }
    onClose();
  }, [
    config.mode,
    office.id,
    localAmount,
    localRate,
    localBases,
    onFixedAmountChange,
    onPercentageRateChange,
    onPercentageBasesChange,
    onClose,
  ]);

  return (
    <Box sx={{ p: 2, minWidth: 280 }}>
      <Typography variant="subtitle2" gutterBottom>
        {config.mode === 'fixed'
          ? `${office.name} - Fixed Amount`
          : 'Percentage (all offices)'}
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <Select
          value={config.mode}
          onChange={e => onModeChange(e.target.value as UpChargePriceTypeMode)}
        >
          <MenuItem value="fixed">Fixed Amount</MenuItem>
          <MenuItem value="percentage">Percentage</MenuItem>
        </Select>
      </FormControl>

      {config.mode === 'fixed' && (
        <TextField
          label="Amount"
          type="number"
          size="small"
          fullWidth
          autoFocus
          value={localAmount || ''}
          onChange={e => setLocalAmount(parseFloat(e.target.value) || 0)}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.01 }}
          sx={{ mb: 2 }}
        />
      )}

      {config.mode === 'percentage' && (
        <>
          <TextField
            label="Rate"
            type="number"
            size="small"
            fullWidth
            autoFocus
            value={localRate || ''}
            onChange={e => setLocalRate(parseFloat(e.target.value) || 0)}
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
                color={localBases.includes(pt.id) ? 'primary' : 'default'}
                onClick={() => {
                  if (localBases.includes(pt.id)) {
                    setLocalBases(localBases.filter(id => id !== pt.id));
                  } else {
                    setLocalBases([...localBases, pt.id]);
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

export function DefaultPricingGrid({
  offices,
  priceTypes,
  configs,
  onChange,
  disabled = false,
  samplePrices,
}: DefaultPricingGridProps): React.ReactElement {
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
  const [bulkMode, setBulkMode] = useState<UpChargePriceTypeMode>('fixed');
  const [bulkAmount, setBulkAmount] = useState<string>('');
  const [bulkRate, setBulkRate] = useState<string>('10');
  const [bulkBases, setBulkBases] = useState<string[]>([]);

  const activePriceTypes = priceTypes.filter(pt => pt.isActive);

  const getConfig = useCallback(
    (priceTypeId: string): UpChargePriceTypeConfig | undefined => {
      return configs.find(c => c.priceTypeId === priceTypeId);
    },
    [configs],
  );

  // Check if a price type is enabled for an office (row exists = enabled)
  const isPriceTypeEnabledForOffice = useCallback(
    (priceType: PriceType, officeId: string): boolean => {
      return priceType.enabledOfficeIds.includes(officeId);
    },
    [],
  );

  const handleCellClick = useCallback(
    (
      priceTypeId: string,
      officeId: string,
      event: React.MouseEvent<HTMLElement>,
    ) => {
      if (disabled) return;
      // Don't allow editing if price type is not enabled for this office
      const priceType = priceTypes.find(pt => pt.id === priceTypeId);
      if (priceType && !isPriceTypeEnabledForOffice(priceType, officeId))
        return;
      setEditingCell({ priceTypeId, officeId, anchorEl: event.currentTarget });
    },
    [disabled, priceTypes, isPriceTypeEnabledForOffice],
  );

  // Handle column header click for bulk edit
  const handleColumnHeaderClick = useCallback(
    (priceTypeId: string, event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      event.stopPropagation();
      // Get current config to initialize bulk edit state
      const config = getConfig(priceTypeId);
      setBulkMode(config?.mode ?? 'fixed');
      setBulkAmount('');
      setBulkRate(
        config?.mode === 'percentage'
          ? String((config.percentageRate ?? 0.1) * 100)
          : '10',
      );
      setBulkBases(
        config?.percentageBaseTypeIds ??
          activePriceTypes.slice(0, 2).map(pt => pt.id),
      );
      setBulkEditColumn({ priceTypeId, anchorEl: event.currentTarget });
    },
    [disabled, getConfig, activePriceTypes],
  );

  // Apply bulk settings to all offices for a price type (only where enabled)
  const handleBulkApply = useCallback(() => {
    if (!bulkEditColumn) return;

    // Find the price type to check which offices have it enabled
    const priceType = priceTypes.find(
      pt => pt.id === bulkEditColumn.priceTypeId,
    );
    const enabledOfficeIds =
      priceType?.enabledOfficeIds ?? offices.map(o => o.id);

    const newConfigs = configs.map(config => {
      if (config.priceTypeId !== bulkEditColumn.priceTypeId) return config;

      if (bulkMode === 'fixed') {
        const amount = parseFloat(bulkAmount) || 0;
        const newAmounts: Record<string, number> = { ...config.fixedAmounts };
        // Only update offices where this price type is enabled
        for (const office of offices) {
          if (enabledOfficeIds.includes(office.id)) {
            newAmounts[office.id] = amount;
          }
        }
        return {
          ...config,
          mode: 'fixed' as UpChargePriceTypeMode,
          fixedAmounts: newAmounts,
          percentageRate: undefined,
          percentageBaseTypeIds: undefined,
        };
      } else {
        // Percentage mode
        const rate = (parseFloat(bulkRate) || 10) / 100;
        return {
          ...config,
          mode: 'percentage' as UpChargePriceTypeMode,
          percentageRate: rate,
          percentageBaseTypeIds:
            bulkBases.length > 0
              ? bulkBases
              : activePriceTypes.slice(0, 2).map(pt => pt.id),
          fixedAmounts: undefined,
        };
      }
    });

    onChange(newConfigs);
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
    configs,
    offices,
    priceTypes,
    onChange,
    activePriceTypes,
  ]);

  // Handlers for cell editor
  const handleFixedAmountChange = useCallback(
    (priceTypeId: string, officeId: string, amount: number) => {
      const newConfigs = configs.map(config => {
        if (config.priceTypeId !== priceTypeId) return config;
        return {
          ...config,
          fixedAmounts: {
            ...config.fixedAmounts,
            [officeId]: amount,
          },
        };
      });
      onChange(newConfigs);
    },
    [configs, onChange],
  );

  const handleModeChange = useCallback(
    (priceTypeId: string, mode: UpChargePriceTypeMode) => {
      const newConfigs = configs.map(config => {
        if (config.priceTypeId !== priceTypeId) return config;
        return {
          ...config,
          mode,
          fixedAmounts:
            mode === 'fixed' ? (config.fixedAmounts ?? {}) : undefined,
          percentageRate:
            mode === 'percentage' ? (config.percentageRate ?? 0.1) : undefined,
          percentageBaseTypeIds:
            mode === 'percentage'
              ? (config.percentageBaseTypeIds ??
                activePriceTypes.slice(0, 2).map(pt => pt.id))
              : undefined,
        };
      });
      onChange(newConfigs);
    },
    [configs, onChange, activePriceTypes],
  );

  const handlePercentageRateChange = useCallback(
    (priceTypeId: string, rate: number) => {
      const newConfigs = configs.map(config => {
        if (config.priceTypeId !== priceTypeId) return config;
        return { ...config, percentageRate: rate };
      });
      onChange(newConfigs);
    },
    [configs, onChange],
  );

  const handlePercentageBasesChange = useCallback(
    (priceTypeId: string, baseIds: string[]) => {
      const newConfigs = configs.map(config => {
        if (config.priceTypeId !== priceTypeId) return config;
        return { ...config, percentageBaseTypeIds: baseIds };
      });
      onChange(newConfigs);
    },
    [configs, onChange],
  );

  // Get mode indicator for column header
  const getModeIndicator = (priceTypeId: string): string => {
    const config = getConfig(priceTypeId);
    if (!config) return '';
    return config.mode === 'percentage' ? ' (%)' : '';
  };

  return (
    <Box>
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
                    {getModeIndicator(pt.id)}
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
                  const config = getConfig(pt.id);
                  if (!config) return <TableCell key={pt.id} />;

                  const isEnabledForOffice = isPriceTypeEnabledForOffice(
                    pt,
                    office.id,
                  );
                  const isCellDisabled = disabled || !isEnabledForOffice;

                  return (
                    <TableCell
                      key={pt.id}
                      align="center"
                      onClick={e => handleCellClick(pt.id, office.id, e)}
                      sx={{
                        cursor: isCellDisabled ? 'default' : 'pointer',
                        bgcolor: !isEnabledForOffice
                          ? 'action.disabledBackground'
                          : undefined,
                        '&:hover': isCellDisabled
                          ? {}
                          : {
                              bgcolor: 'action.hover',
                            },
                        py: 1,
                      }}
                    >
                      <CellDisplay
                        config={config}
                        office={office}
                        samplePrices={samplePrices}
                        isDisabled={!isEnabledForOffice}
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
        {editingCell && getConfig(editingCell.priceTypeId) && (
          <CellEditor
            config={getConfig(editingCell.priceTypeId)!}
            office={offices.find(o => o.id === editingCell.officeId)!}
            priceTypes={priceTypes}
            onFixedAmountChange={(officeId, amount) =>
              handleFixedAmountChange(editingCell.priceTypeId, officeId, amount)
            }
            onModeChange={mode =>
              handleModeChange(editingCell.priceTypeId, mode)
            }
            onPercentageRateChange={rate =>
              handlePercentageRateChange(editingCell.priceTypeId, rate)
            }
            onPercentageBasesChange={bases =>
              handlePercentageBasesChange(editingCell.priceTypeId, bases)
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
                setBulkMode(e.target.value as UpChargePriceTypeMode)
              }
            >
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
