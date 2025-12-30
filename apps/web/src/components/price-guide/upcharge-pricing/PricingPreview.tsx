/**
 * Pricing Preview Component.
 * Shows calculated totals based on sample option pricing.
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import { calculatePreviewTotal, formatPercentageRate } from './utils';

import type { UpChargePriceTypeConfig, PriceType } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type PricingPreviewProps = {
  /** Price type configurations */
  configs: UpChargePriceTypeConfig[];
  /** Available price types */
  priceTypes: PriceType[];
  /** Sample option name for display */
  sampleOptionName: string;
  /** Office to show preview for */
  officeId: string;
  /** Office name for display */
  officeName: string;
  /** Sample option prices keyed by price type ID */
  sampleOptionPrices: Record<string, number>;
};

// ============================================================================
// Component
// ============================================================================

export function PricingPreview({
  configs,
  priceTypes,
  sampleOptionName,
  officeId,
  officeName,
  sampleOptionPrices,
}: PricingPreviewProps): React.ReactElement {
  // Calculate line items for each price type
  const lineItems = useMemo(() => {
    return configs.map(config => {
      const priceType = priceTypes.find(pt => pt.id === config.priceTypeId);
      const priceTypeName = priceType?.name ?? 'Unknown';

      switch (config.mode) {
        case 'percentage': {
          const baseSum = (config.percentageBaseTypeIds ?? []).reduce(
            (sum, typeId) => sum + (sampleOptionPrices[typeId] ?? 0),
            0,
          );
          const rate = config.percentageRate ?? 0;
          const amount = baseSum * rate;
          const baseNames = (config.percentageBaseTypeIds ?? [])
            .map(id => priceTypes.find(pt => pt.id === id)?.code.charAt(0))
            .filter(Boolean)
            .join('+');
          return {
            priceTypeName,
            description: `${formatPercentageRate(rate)} of ${baseNames || 'none'} ($${baseSum.toFixed(2)})`,
            amount,
          };
        }
        case 'fixed':
        default: {
          const amount = config.fixedAmounts?.[officeId] ?? 0;
          return {
            priceTypeName,
            description: 'fixed',
            amount,
          };
        }
      }
    });
  }, [configs, priceTypes, officeId, sampleOptionPrices]);

  const total = useMemo(
    () => calculatePreviewTotal(configs, officeId, sampleOptionPrices),
    [configs, officeId, sampleOptionPrices],
  );

  // Format sample option prices for display
  const samplePricesDisplay = useMemo(() => {
    return priceTypes
      .filter(pt => pt.isActive)
      .map(pt => {
        const amount = sampleOptionPrices[pt.id] ?? 0;
        return `${pt.code.charAt(0)}: $${amount.toFixed(0)}`;
      })
      .join(', ');
  }, [priceTypes, sampleOptionPrices]);

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        Calculated Total Preview
      </Typography>
      <Typography variant="caption" color="text.secondary" paragraph>
        Example with {sampleOptionName} @ {officeName} ({samplePricesDisplay})
      </Typography>

      <Stack spacing={0.5}>
        {lineItems.map((item, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="body2">• {item.priceTypeName}:</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.description}
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: item.amount > 0 ? 500 : 400,
                color: item.amount === 0 ? 'text.secondary' : 'text.primary',
              }}
            >
              ${item.amount.toFixed(2)}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" fontWeight={600}>
          TOTAL:
        </Typography>
        <Typography variant="body1" fontWeight={600} color="primary.main">
          ${total.toFixed(2)}
        </Typography>
      </Box>
    </Box>
  );
}
