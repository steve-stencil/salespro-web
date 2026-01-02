/**
 * Utility functions for UpCharge pricing calculations and transformations.
 */

import type {
  UpChargePriceTypeMode,
  UpChargePriceTypeConfig,
  UpChargeOfficePricing,
  UpChargeModeDisplay,
  PriceType,
} from '@shared/types';

/**
 * Determines the mode for a price type based on API response data.
 */
export function determinePriceTypeMode(
  priceData: { amount: number; isPercentage: boolean } | undefined,
): UpChargePriceTypeMode {
  if (!priceData) return 'fixed';
  if (priceData.isPercentage) return 'percentage';
  return 'fixed';
}

/**
 * Transforms API pricing data into a structured config per price type.
 */
export function transformToConfig(
  officePricing: UpChargeOfficePricing[],
  priceTypes: Array<{ id: string; code: string; name: string }>,
): UpChargePriceTypeConfig[] {
  if (officePricing.length === 0) {
    // No pricing data - default to fixed with $0
    return priceTypes.map(pt => ({
      priceTypeId: pt.id,
      mode: 'fixed' as UpChargePriceTypeMode,
      fixedAmounts: {},
    }));
  }

  return priceTypes.map(pt => {
    // Check first office to determine mode (should be consistent across offices)
    const firstOffice = officePricing[0];
    const samplePrice = firstOffice?.prices[pt.id];

    if (samplePrice?.isPercentage) {
      return {
        priceTypeId: pt.id,
        mode: 'percentage' as UpChargePriceTypeMode,
        percentageRate: samplePrice.amount,
        percentageBaseTypeIds: samplePrice.percentageBaseTypeIds,
      };
    }

    // Fixed mode - collect amounts per office (including $0)
    const fixedAmounts: Record<string, number> = {};
    for (const officePrices of officePricing) {
      const price = officePrices.prices[pt.id];
      fixedAmounts[officePrices.office.id] = price?.amount ?? 0;
    }

    return {
      priceTypeId: pt.id,
      mode: 'fixed' as UpChargePriceTypeMode,
      fixedAmounts,
    };
  });
}

/**
 * Transforms config back to API request format for a single office.
 */
export function transformToApiRequest(
  configs: UpChargePriceTypeConfig[],
  officeId: string,
): Array<{
  priceTypeId: string;
  amount: number;
  isPercentage: boolean;
  percentageBaseTypeIds?: string[];
}> {
  return configs.map(config => {
    switch (config.mode) {
      case 'percentage':
        return {
          priceTypeId: config.priceTypeId,
          amount: config.percentageRate ?? 0,
          isPercentage: true,
          percentageBaseTypeIds: config.percentageBaseTypeIds,
        };
      case 'fixed':
      default:
        return {
          priceTypeId: config.priceTypeId,
          amount: config.fixedAmounts?.[officeId] ?? 0,
          isPercentage: false,
        };
    }
  });
}

/**
 * Derives the display mode summary for an upcharge.
 */
export function deriveDisplayMode(
  configs: UpChargePriceTypeConfig[],
  priceTypes: Array<{ id: string; code: string; name: string }>,
): UpChargeModeDisplay {
  if (configs.length === 0) {
    return { type: 'none' };
  }

  const allFixed = configs.every(c => c.mode === 'fixed');
  const allPercentage = configs.every(c => c.mode === 'percentage');

  if (allFixed) {
    return { type: 'all_fixed' };
  }

  if (allPercentage) {
    // Check if all have the same rate and base types
    const firstConfig = configs[0];
    const sameRate = configs.every(
      c => c.percentageRate === firstConfig?.percentageRate,
    );
    const sameBase = configs.every(
      c =>
        JSON.stringify(c.percentageBaseTypeIds?.sort()) ===
        JSON.stringify(firstConfig?.percentageBaseTypeIds?.sort()),
    );

    if (sameRate && sameBase && firstConfig) {
      const baseTypes =
        firstConfig.percentageBaseTypeIds
          ?.map(id => priceTypes.find(pt => pt.id === id)?.code)
          .filter(Boolean) ?? [];

      return {
        type: 'all_percentage',
        rate: (firstConfig.percentageRate ?? 0) * 100,
        baseTypes: baseTypes as string[],
      };
    }
  }

  return { type: 'mixed' };
}

/**
 * Formats a percentage rate for display.
 */
export function formatPercentageRate(rate: number): string {
  const percentage = rate * 100;
  return percentage % 1 === 0 ? `${percentage}%` : `${percentage.toFixed(2)}%`;
}

/**
 * Formats base types for display (e.g., "M+L" for Materials + Labor).
 */
export function formatBaseTypes(
  baseTypeIds: string[],
  priceTypes: PriceType[],
): string {
  const codes = baseTypeIds
    .map(id => priceTypes.find(pt => pt.id === id)?.code.charAt(0))
    .filter(Boolean);
  return codes.join('+');
}

/**
 * Calculates the preview total for an upcharge based on sample option pricing.
 */
export function calculatePreviewTotal(
  configs: UpChargePriceTypeConfig[],
  officeId: string,
  sampleOptionPrices: Record<string, number>,
): number {
  return configs.reduce((total, config) => {
    switch (config.mode) {
      case 'percentage': {
        const baseSum = (config.percentageBaseTypeIds ?? []).reduce(
          (sum, typeId) => sum + (sampleOptionPrices[typeId] ?? 0),
          0,
        );
        return total + baseSum * (config.percentageRate ?? 0);
      }
      case 'fixed':
      default:
        return total + (config.fixedAmounts?.[officeId] ?? 0);
    }
  }, 0);
}

/**
 * Validates the configuration for a price type.
 */
export function validatePriceTypeConfig(config: UpChargePriceTypeConfig): {
  valid: boolean;
  error?: string;
} {
  if (config.mode === 'percentage') {
    if (
      !config.percentageBaseTypeIds ||
      config.percentageBaseTypeIds.length === 0
    ) {
      return {
        valid: false,
        error: 'Select at least one price type for the percentage base',
      };
    }
    if (config.percentageBaseTypeIds.includes(config.priceTypeId)) {
      return {
        valid: false,
        error: 'Cannot base a price type on itself',
      };
    }
  }
  return { valid: true };
}
