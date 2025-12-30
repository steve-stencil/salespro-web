/**
 * UpCharge Pricing Configuration Component.
 * Configures per-price-type mixed mode pricing (Fixed or Percentage per price type).
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useMemo } from 'react';

import { FixedModeConfig } from './FixedModeConfig';
import { PercentageModeConfig } from './PercentageModeConfig';
import { PriceTypeModeSelector } from './PriceTypeModeSelector';
import { PricingPreview } from './PricingPreview';
import { validatePriceTypeConfig } from './utils';

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

type UpChargePricingConfigProps = {
  /** Available price types */
  priceTypes: PriceType[];
  /** Available offices */
  offices: Office[];
  /** Current pricing configurations per price type */
  configs: UpChargePriceTypeConfig[];
  /** Callback when configs change */
  onChange: (configs: UpChargePriceTypeConfig[]) => void;
  /** Sample option for preview */
  sampleOption?: {
    id: string;
    name: string;
    prices: Record<string, number>;
  };
  /** Disable editing */
  disabled?: boolean;
};

// ============================================================================
// Component
// ============================================================================

export function UpChargePricingConfig({
  priceTypes,
  offices,
  configs,
  onChange,
  sampleOption,
  disabled = false,
}: UpChargePricingConfigProps): React.ReactElement {
  // Get active price types
  const activePriceTypes = useMemo(
    () => priceTypes.filter(pt => pt.isActive),
    [priceTypes],
  );

  // Validation
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const config of configs) {
      const result = validatePriceTypeConfig(config);
      if (!result.valid && result.error) {
        errors[config.priceTypeId] = result.error;
      }
    }
    return errors;
  }, [configs]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  // Handler for price type mode change
  const handlePriceTypeModeChange = useCallback(
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
                activePriceTypes
                  .filter(pt => pt.id !== priceTypeId)
                  .slice(0, 2)
                  .map(pt => pt.id))
              : undefined,
        };
      });
      onChange(newConfigs);
    },
    [configs, onChange, activePriceTypes],
  );

  // Handler for fixed amounts change
  const handleFixedAmountsChange = useCallback(
    (priceTypeId: string, amounts: Record<string, number>) => {
      const newConfigs = configs.map(config => {
        if (config.priceTypeId !== priceTypeId) return config;
        return { ...config, fixedAmounts: amounts };
      });
      onChange(newConfigs);
    },
    [configs, onChange],
  );

  // Handler for percentage rate change
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

  // Handler for percentage base types change
  const handleBaseTypesChange = useCallback(
    (priceTypeId: string, baseTypeIds: string[]) => {
      const newConfigs = configs.map(config => {
        if (config.priceTypeId !== priceTypeId) return config;
        return { ...config, percentageBaseTypeIds: baseTypeIds };
      });
      onChange(newConfigs);
    },
    [configs, onChange],
  );

  return (
    <Box>
      {/* Price Type Configuration */}
      <Stack spacing={2}>
        {activePriceTypes.map(priceType => {
          const config = configs.find(c => c.priceTypeId === priceType.id);
          if (!config) return null;

          const error = validationErrors[priceType.id];

          return (
            <Card key={priceType.id} variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1.5,
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {priceType.name}
                  </Typography>
                  <PriceTypeModeSelector
                    value={config.mode}
                    onChange={mode =>
                      handlePriceTypeModeChange(priceType.id, mode)
                    }
                    disabled={disabled}
                  />
                </Box>

                <Collapse in={config.mode === 'fixed'}>
                  <FixedModeConfig
                    offices={offices}
                    amounts={config.fixedAmounts ?? {}}
                    onChange={amounts =>
                      handleFixedAmountsChange(priceType.id, amounts)
                    }
                    disabled={disabled}
                  />
                </Collapse>

                <Collapse in={config.mode === 'percentage'}>
                  <PercentageModeConfig
                    priceTypes={priceTypes}
                    rate={config.percentageRate ?? 0}
                    baseTypeIds={config.percentageBaseTypeIds ?? []}
                    onRateChange={rate =>
                      handlePercentageRateChange(priceType.id, rate)
                    }
                    onBaseTypesChange={ids =>
                      handleBaseTypesChange(priceType.id, ids)
                    }
                    disabled={disabled}
                    samplePrices={sampleOption?.prices}
                  />
                </Collapse>

                {error && (
                  <Alert severity="error" sx={{ mt: 1.5 }}>
                    {error}
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {hasValidationErrors && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Please fix the validation errors above before saving.
        </Alert>
      )}

      {/* Preview */}
      {sampleOption && (
        <Box sx={{ mt: 3 }}>
          <PricingPreview
            configs={configs}
            priceTypes={priceTypes}
            sampleOptionName={sampleOption.name}
            officeId={offices[0]?.id ?? ''}
            officeName={offices[0]?.name ?? 'Office'}
            sampleOptionPrices={sampleOption.prices}
          />
        </Box>
      )}
    </Box>
  );
}
