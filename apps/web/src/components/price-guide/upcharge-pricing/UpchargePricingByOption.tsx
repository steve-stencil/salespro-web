/**
 * Upcharge Pricing by Option Component.
 * Shows upcharge pricing with per-option, per-office overrides using a compact grid.
 * Used in the UpCharge Pricing tab of the Pricing Page.
 */

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo, useEffect } from 'react';

import {
  useUpchargePricing,
  useUpdateUpchargeOverridePrices,
  useDeleteUpchargeOverridePrices,
  usePriceTypes,
  useOptionPricing,
} from '../../../hooks/usePriceGuide';

import { OverridePricingGrid } from './OverridePricingGrid';
import { transformToConfig } from './utils';

import type {
  OverrideGridData,
  OfficeOverrideConfig,
} from './OverridePricingGrid';
import type { UpChargePriceTypeConfig, PriceType } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type Office = {
  id: string;
  name: string;
};

type OptionInfo = {
  id: string;
  name: string;
  brand?: string | null;
};

type UpchargePricingByOptionProps = {
  /** The upcharge ID */
  upchargeId: string;
  /** The upcharge name */
  upchargeName: string;
  /** The upcharge note (optional) */
  upchargeNote?: string | null;
  /** Options linked to this MSI */
  options: OptionInfo[];
  /** Available offices */
  offices: Office[];
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates initial grid data from default configs.
 * All cells are set to "use_default" mode - the actual default values
 * are displayed by looking up the defaultConfig in the grid component.
 */
function createGridDataFromDefaults(
  defaultConfigs: UpChargePriceTypeConfig[],
  offices: Array<{ id: string }>,
): OverrideGridData {
  const data: OverrideGridData = {};
  for (const config of defaultConfigs) {
    const priceTypeData: Record<string, { mode: 'use_default' }> = {};
    for (const office of offices) {
      // All cells use default mode - the CellDisplay component
      // will look up the actual default value from defaultConfigs
      priceTypeData[office.id] = { mode: 'use_default' };
    }
    data[config.priceTypeId] = priceTypeData;
  }
  return data;
}

/**
 * Transforms API option override data to grid format.
 */
function transformOverrideToGrid(
  overridePricing: {
    option: { id: string; name: string };
    byOffice: Record<
      string,
      {
        office: { id: string; name: string };
        prices: Record<
          string,
          {
            amount: number;
            isPercentage: boolean;
            percentageBaseTypeIds: string[];
          }
        >;
      }
    >;
  },
  priceTypes: Array<{ id: string }>,
  offices: Array<{ id: string }>,
): OverrideGridData {
  const data: OverrideGridData = {};

  for (const pt of priceTypes) {
    const priceTypeData: Record<string, OfficeOverrideConfig> = {};
    for (const office of offices) {
      const officeData = overridePricing.byOffice[office.id];
      const priceData = officeData?.prices[pt.id];

      if (!priceData) {
        priceTypeData[office.id] = { mode: 'use_default' };
      } else if (priceData.isPercentage) {
        priceTypeData[office.id] = {
          mode: 'percentage',
          percentageRate: priceData.amount,
          percentageBaseTypeIds: priceData.percentageBaseTypeIds,
        };
      } else {
        priceTypeData[office.id] = {
          mode: 'fixed',
          fixedAmount: priceData.amount,
        };
      }
    }
    data[pt.id] = priceTypeData;
  }

  return data;
}

/**
 * Counts custom (non-default) overrides in grid data.
 */
function countCustomOverrides(data: OverrideGridData): number {
  let count = 0;
  for (const priceTypeData of Object.values(data)) {
    for (const config of Object.values(priceTypeData)) {
      if (config.mode !== 'use_default') count++;
    }
  }
  return count;
}

// ============================================================================
// Single Option Override Card
// ============================================================================

type OptionOverrideCardProps = {
  option: OptionInfo;
  upchargeId: string;
  offices: Office[];
  priceTypes: PriceType[];
  defaultConfigs: UpChargePriceTypeConfig[];
  existingOverride?: {
    option: { id: string; name: string };
    byOffice: Record<
      string,
      {
        office: { id: string; name: string };
        prices: Record<
          string,
          {
            amount: number;
            isPercentage: boolean;
            percentageBaseTypeIds: string[];
          }
        >;
      }
    >;
  };
  upchargeVersion: number;
};

function OptionOverrideCard({
  option,
  upchargeId,
  offices,
  priceTypes,
  defaultConfigs,
  existingOverride,
  upchargeVersion,
}: OptionOverrideCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [gridData, setGridData] = useState<OverrideGridData>({});

  // Fetch actual option prices
  const { data: optionPricingData } = useOptionPricing(option.id);

  // Compute sample prices from option's actual pricing (using first office)
  const samplePrices = useMemo(() => {
    if (!optionPricingData?.byOffice) return undefined;
    // Get prices from the first office as sample
    const firstOfficeData = Object.values(optionPricingData.byOffice)[0];
    return firstOfficeData?.prices;
  }, [optionPricingData]);

  // Mutations
  const updateOverrideMutation = useUpdateUpchargeOverridePrices();
  const deleteOverrideMutation = useDeleteUpchargeOverridePrices();

  // Count custom overrides
  const customOverrideCount = useMemo(() => {
    return countCustomOverrides(gridData);
  }, [gridData]);

  const hasCustomOverride = customOverrideCount > 0;

  // Initialize grid data from existing override or default configs
  useEffect(() => {
    if (priceTypes.length === 0 || defaultConfigs.length === 0) return;

    if (existingOverride) {
      // Use existing override data
      const transformed = transformOverrideToGrid(
        existingOverride,
        priceTypes,
        offices,
      );
      setGridData(transformed);
    } else {
      // Initialize with default configs (all cells show "use_default" mode but with default values)
      const initial = createGridDataFromDefaults(defaultConfigs, offices);
      setGridData(initial);
    }
  }, [existingOverride, priceTypes, offices, defaultConfigs]);

  // Handlers
  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const handleResetToDefault = useCallback(() => {
    const initialData = createGridDataFromDefaults(defaultConfigs, offices);
    setGridData(initialData);
    setHasChanges(true);
  }, [defaultConfigs, offices]);

  const handleGridChange = useCallback((newData: OverrideGridData) => {
    setGridData(newData);
    setHasChanges(true);
  }, []);

  const handleRemoveOverride = useCallback(async () => {
    try {
      await deleteOverrideMutation.mutateAsync({
        upchargeId,
        optionId: option.id,
      });
      // Reset to defaults after removing override
      const initialData = createGridDataFromDefaults(defaultConfigs, offices);
      setGridData(initialData);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to delete override:', err);
    }
  }, [deleteOverrideMutation, upchargeId, option.id, defaultConfigs, offices]);

  const handleSave = useCallback(async () => {
    try {
      // Collect all prices to save (non-default configs)
      const allPrices: Array<{
        priceTypeId: string;
        amount: number;
        isPercentage: boolean;
        percentageBaseTypeIds?: string[];
      }> = [];

      for (const [priceTypeId, priceTypeData] of Object.entries(gridData)) {
        for (const config of Object.values(priceTypeData)) {
          if (config.mode === 'use_default') continue;

          if (config.mode === 'percentage') {
            allPrices.push({
              priceTypeId,
              amount: config.percentageRate ?? 0,
              isPercentage: true,
              percentageBaseTypeIds: config.percentageBaseTypeIds,
            });
          } else {
            allPrices.push({
              priceTypeId,
              amount: config.fixedAmount ?? 0,
              isPercentage: false,
            });
          }
        }
      }

      // If no custom prices, delete any existing overrides for this option
      if (allPrices.length === 0) {
        try {
          await deleteOverrideMutation.mutateAsync({
            upchargeId,
            optionId: option.id,
          });
        } catch {
          // Ignore if no overrides exist
        }
        setHasChanges(false);
        return;
      }

      // Save prices for each office that has custom pricing
      for (const office of offices) {
        const prices: Array<{
          priceTypeId: string;
          amount: number;
          isPercentage: boolean;
          percentageBaseTypeIds?: string[];
        }> = [];

        for (const [priceTypeId, priceTypeData] of Object.entries(gridData)) {
          const config = priceTypeData[office.id];
          if (!config || config.mode === 'use_default') continue;

          if (config.mode === 'percentage') {
            prices.push({
              priceTypeId,
              amount: config.percentageRate ?? 0,
              isPercentage: true,
              percentageBaseTypeIds: config.percentageBaseTypeIds,
            });
          } else {
            prices.push({
              priceTypeId,
              amount: config.fixedAmount ?? 0,
              isPercentage: false,
            });
          }
        }

        if (prices.length > 0) {
          await updateOverrideMutation.mutateAsync({
            upchargeId,
            data: {
              optionId: option.id,
              officeId: office.id,
              prices,
              version: upchargeVersion,
            },
          });
        } else {
          // Delete overrides for this office if switching back to default
          try {
            await deleteOverrideMutation.mutateAsync({
              upchargeId,
              optionId: option.id,
              officeId: office.id,
            });
          } catch {
            // Ignore if no overrides exist for this office
          }
        }
      }
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save override:', err);
    }
  }, [
    gridData,
    offices,
    updateOverrideMutation,
    deleteOverrideMutation,
    upchargeId,
    option.id,
    upchargeVersion,
  ]);

  const isSaving =
    updateOverrideMutation.isPending || deleteOverrideMutation.isPending;

  return (
    <Accordion
      expanded={expanded}
      onChange={handleToggle}
      variant="outlined"
      disableGutters
      sx={{ '&:before': { display: 'none' } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ minHeight: 48, '& .MuiAccordionSummary-content': { my: 1 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            {option.name}
            {option.brand && (
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{ ml: 0.5 }}
              >
                ({option.brand})
              </Typography>
            )}
          </Typography>
          {hasCustomOverride && (
            <Chip
              label={`${customOverrideCount} custom`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {hasChanges && (
            <Chip
              label="Unsaved"
              size="small"
              color="warning"
              variant="filled"
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {hasCustomOverride
              ? "Click any cell to customize. Cells showing default values will use the upcharge's default pricing."
              : 'Using default pricing. Click any cell to add a custom override.'}
          </Typography>

          <OverridePricingGrid
            offices={offices}
            priceTypes={priceTypes}
            data={gridData}
            onChange={handleGridChange}
            defaultConfigs={defaultConfigs}
            disabled={isSaving}
            samplePrices={samplePrices}
          />

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            {hasCustomOverride ? (
              <Button
                size="small"
                color="error"
                onClick={() => void handleRemoveOverride()}
                disabled={isSaving}
              >
                Reset to Defaults
              </Button>
            ) : (
              <Box /> // Spacer
            )}

            {hasChanges && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => {
                    // Reset to original
                    if (existingOverride) {
                      const transformed = transformOverrideToGrid(
                        existingOverride,
                        priceTypes,
                        offices,
                      );
                      setGridData(transformed);
                    } else {
                      handleResetToDefault();
                    }
                    setHasChanges(false);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  startIcon={
                    isSaving ? <CircularProgress size={14} /> : undefined
                  }
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UpchargePricingByOption({
  upchargeId,
  upchargeName,
  upchargeNote,
  options,
  offices,
}: UpchargePricingByOptionProps): React.ReactElement {
  // Queries
  const {
    data: pricingData,
    isLoading,
    error,
  } = useUpchargePricing(upchargeId);
  const { data: priceTypesData } = usePriceTypes();

  // Get active price types
  const priceTypes = useMemo(() => {
    if (!priceTypesData?.priceTypes) return [];
    return priceTypesData.priceTypes.filter(pt => pt.isActive);
  }, [priceTypesData]);

  // Transform default configs
  const defaultConfigs = useMemo(() => {
    if (!pricingData || priceTypes.length === 0) return [];
    return transformToConfig(pricingData.defaultPricing, priceTypes);
  }, [pricingData, priceTypes]);

  // Get existing overrides map
  const existingOverridesMap = useMemo(() => {
    if (!pricingData?.globalOptionOverrides) return new Map();
    const map = new Map<
      string,
      {
        option: { id: string; name: string };
        byOffice: Record<
          string,
          {
            office: { id: string; name: string };
            prices: Record<
              string,
              {
                amount: number;
                isPercentage: boolean;
                percentageBaseTypeIds: string[];
              }
            >;
          }
        >;
      }
    >();
    for (const override of pricingData.globalOptionOverrides) {
      map.set(override.option.id, override);
    }
    return map;
  }, [pricingData]);

  // Get default pricing summary for display
  const defaultPricingSummary = useMemo(() => {
    if (defaultConfigs.length === 0) return 'Not configured';
    const modes = defaultConfigs.map(c => c.mode);
    const allSame = modes.every(m => m === modes[0]);
    if (allSame) {
      const mode = modes[0];
      if (mode === 'fixed') return 'Fixed pricing';
      if (mode === 'percentage') return 'Percentage-based';
    }
    return 'Mixed mode';
  }, [defaultConfigs]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading pricing...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">Failed to load pricing for {upchargeName}</Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {upchargeName}
          {upchargeNote && (
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              — {upchargeNote}
            </Typography>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Default: {defaultPricingSummary} • Expand an option to add custom
          pricing
        </Typography>
      </Box>

      <Stack spacing={1}>
        {options.map(option => (
          <OptionOverrideCard
            key={option.id}
            option={option}
            upchargeId={upchargeId}
            offices={offices}
            priceTypes={priceTypes}
            defaultConfigs={defaultConfigs}
            existingOverride={existingOverridesMap.get(option.id)}
            upchargeVersion={pricingData?.upcharge.version ?? 1}
          />
        ))}
      </Stack>
    </Box>
  );
}
