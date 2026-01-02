/**
 * Time Estimation Utility for Price Guide Import
 *
 * Estimates import duration based on entity counts and historical benchmarks.
 */

import type { PriceGuideSourceCounts } from '../types';

/**
 * Estimated seconds per item for each entity type.
 * Based on empirical measurements from test imports.
 */
const SECONDS_PER_ITEM = {
  categories: 0.1,
  additionalDetails: 0.05,
  options: 0.1,
  upcharges: 0.15,
  msis: 0.2,
  images: 1.0,
} as const;

/**
 * Time estimation configuration.
 */
type EstimationConfig = {
  /** Whether to include image migration */
  includeImages: boolean;
  /** Number of unique images to process */
  imageCount?: number;
};

/**
 * Time estimation result.
 */
type TimeEstimate = {
  /** Minimum estimated minutes */
  minMinutes: number;
  /** Maximum estimated minutes */
  maxMinutes: number;
  /** Human-readable estimate string */
  displayText: string;
};

/**
 * Estimate import time based on entity counts.
 *
 * @param counts - Entity counts from source database
 * @param config - Estimation configuration
 * @returns Time estimate with min/max minutes and display text
 */
export function estimateImportTime(
  counts: PriceGuideSourceCounts,
  config: EstimationConfig,
): TimeEstimate {
  let totalSeconds = 0;

  // Calculate base time for each entity type
  totalSeconds += counts.categories * SECONDS_PER_ITEM.categories;
  totalSeconds += counts.options * SECONDS_PER_ITEM.options;
  totalSeconds += counts.upCharges * SECONDS_PER_ITEM.upcharges;
  totalSeconds += counts.msis * SECONDS_PER_ITEM.msis;

  // Add additional details if available
  if (counts.additionalDetails) {
    totalSeconds +=
      counts.additionalDetails * SECONDS_PER_ITEM.additionalDetails;
  }

  // Add image download time if enabled
  if (config.includeImages) {
    const imageCount = config.imageCount ?? counts.images ?? 0;
    totalSeconds += imageCount * SECONDS_PER_ITEM.images;
  }

  // Convert to minutes
  const baseMinutes = totalSeconds / 60;

  // Apply variance factor (30% variance for min/max)
  const minMinutes = Math.ceil(baseMinutes * 0.7);
  const maxMinutes = Math.ceil(baseMinutes * 1.3);

  return {
    minMinutes,
    maxMinutes,
    displayText: formatTimeRange(minMinutes, maxMinutes),
  };
}

/**
 * Format a time range for display.
 *
 * @param minMinutes - Minimum minutes
 * @param maxMinutes - Maximum minutes
 * @returns Formatted string like "5-10 minutes" or "~2 hours"
 */
export function formatTimeRange(
  minMinutes: number,
  maxMinutes: number,
): string {
  // Handle very short estimates
  if (maxMinutes < 1) {
    return 'less than a minute';
  }

  // Handle estimates under an hour
  if (maxMinutes < 60) {
    if (minMinutes === maxMinutes) {
      return `~${minMinutes} minute${minMinutes !== 1 ? 's' : ''}`;
    }
    return `${minMinutes}-${maxMinutes} minutes`;
  }

  // Handle estimates over an hour
  const minHours = Math.floor(minMinutes / 60);
  const maxHours = Math.ceil(maxMinutes / 60);

  if (minHours === maxHours) {
    return `~${minHours} hour${minHours !== 1 ? 's' : ''}`;
  }

  return `${minHours}-${maxHours} hours`;
}

/**
 * Format elapsed time for display.
 *
 * @param seconds - Elapsed time in seconds
 * @returns Formatted string like "5m 30s" or "1h 15m"
 */
export function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Calculate estimated remaining time based on current progress.
 *
 * @param elapsedSeconds - Time elapsed so far
 * @param progressPercent - Progress as percentage (0-100)
 * @returns Estimated remaining time in seconds
 */
export function calculateRemainingTime(
  elapsedSeconds: number,
  progressPercent: number,
): number {
  if (progressPercent <= 0) {
    return 0;
  }

  if (progressPercent >= 100) {
    return 0;
  }

  // Calculate rate and extrapolate
  const rate = elapsedSeconds / progressPercent;
  const totalEstimate = rate * 100;
  const remaining = totalEstimate - elapsedSeconds;

  return Math.max(0, remaining);
}
