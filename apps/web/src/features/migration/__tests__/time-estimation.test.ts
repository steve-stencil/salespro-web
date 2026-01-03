/**
 * Time Estimation Utility Tests
 *
 * Unit tests for the price guide import time estimation utilities.
 */

import { describe, it, expect } from 'vitest';

import {
  estimateImportTime,
  formatTimeRange,
  formatElapsedTime,
  calculateRemainingTime,
} from '../utils/time-estimation';

import type { PriceGuideSourceCounts } from '../types';

describe('estimateImportTime', () => {
  it('should estimate time for a small import without images', () => {
    const counts: PriceGuideSourceCounts = {
      categories: 10,
      msis: 50,
      options: 100,
      upCharges: 30,
    };

    const result = estimateImportTime(counts, { includeImages: false });

    expect(result.minMinutes).toBeGreaterThanOrEqual(0);
    expect(result.maxMinutes).toBeGreaterThanOrEqual(result.minMinutes);
    expect(result.displayText).toBeTruthy();
  });

  it('should estimate longer time when including images', () => {
    const counts: PriceGuideSourceCounts = {
      categories: 10,
      msis: 50,
      options: 100,
      upCharges: 30,
      images: 100,
    };

    const withoutImages = estimateImportTime(counts, { includeImages: false });
    const withImages = estimateImportTime(counts, { includeImages: true });

    expect(withImages.maxMinutes).toBeGreaterThan(withoutImages.maxMinutes);
  });

  it('should use provided imageCount over counts.images', () => {
    const counts: PriceGuideSourceCounts = {
      categories: 10,
      msis: 50,
      options: 100,
      upCharges: 30,
      images: 100,
    };

    const result = estimateImportTime(counts, {
      includeImages: true,
      imageCount: 200,
    });

    const resultWithDefaultImages = estimateImportTime(counts, {
      includeImages: true,
    });

    expect(result.maxMinutes).toBeGreaterThan(
      resultWithDefaultImages.maxMinutes,
    );
  });

  it('should handle empty counts', () => {
    const counts: PriceGuideSourceCounts = {
      categories: 0,
      msis: 0,
      options: 0,
      upCharges: 0,
    };

    const result = estimateImportTime(counts, { includeImages: false });

    expect(result.minMinutes).toBe(0);
    expect(result.maxMinutes).toBe(0);
  });

  it('should include additionalDetails in estimation', () => {
    const countsWithoutDetails: PriceGuideSourceCounts = {
      categories: 10,
      msis: 50,
      options: 100,
      upCharges: 30,
    };

    const countsWithDetails: PriceGuideSourceCounts = {
      ...countsWithoutDetails,
      additionalDetails: 500,
    };

    const withoutDetails = estimateImportTime(countsWithoutDetails, {
      includeImages: false,
    });
    const withDetails = estimateImportTime(countsWithDetails, {
      includeImages: false,
    });

    expect(withDetails.maxMinutes).toBeGreaterThan(withoutDetails.maxMinutes);
  });

  it('should provide a reasonable displayText', () => {
    const counts: PriceGuideSourceCounts = {
      categories: 100,
      msis: 1000,
      options: 2000,
      upCharges: 500,
    };

    const result = estimateImportTime(counts, { includeImages: false });

    expect(result.displayText).toMatch(/\d+.*minute|hour|less than/i);
  });
});

describe('formatTimeRange', () => {
  it('should return "less than a minute" for very short times', () => {
    expect(formatTimeRange(0, 0)).toBe('less than a minute');
  });

  it('should format single minute correctly', () => {
    expect(formatTimeRange(1, 1)).toBe('~1 minute');
  });

  it('should format minute range correctly', () => {
    expect(formatTimeRange(5, 10)).toBe('5-10 minutes');
  });

  it('should format single hour correctly', () => {
    expect(formatTimeRange(60, 60)).toBe('~1 hour');
  });

  it('should format hour range correctly', () => {
    expect(formatTimeRange(90, 150)).toBe('1-3 hours');
  });

  it('should handle same min and max minutes', () => {
    expect(formatTimeRange(30, 30)).toBe('~30 minutes');
  });

  it('should pluralize correctly', () => {
    expect(formatTimeRange(2, 2)).toBe('~2 minutes');
    expect(formatTimeRange(120, 120)).toBe('~2 hours');
  });
});

describe('formatElapsedTime', () => {
  it('should format seconds only', () => {
    expect(formatElapsedTime(30)).toBe('30s');
    expect(formatElapsedTime(0)).toBe('0s');
  });

  it('should format minutes and seconds', () => {
    expect(formatElapsedTime(90)).toBe('1m 30s');
    expect(formatElapsedTime(120)).toBe('2m');
  });

  it('should format hours and minutes', () => {
    expect(formatElapsedTime(3700)).toBe('1h 1m');
    expect(formatElapsedTime(3600)).toBe('1h');
    expect(formatElapsedTime(7200)).toBe('2h');
  });

  it('should floor fractional seconds', () => {
    expect(formatElapsedTime(30.7)).toBe('30s');
    expect(formatElapsedTime(90.9)).toBe('1m 30s');
  });

  it('should handle minutes without remaining seconds', () => {
    expect(formatElapsedTime(300)).toBe('5m');
  });

  it('should handle hours without remaining minutes', () => {
    expect(formatElapsedTime(7200)).toBe('2h');
  });
});

describe('calculateRemainingTime', () => {
  it('should return 0 when progress is 0', () => {
    expect(calculateRemainingTime(100, 0)).toBe(0);
  });

  it('should return 0 when progress is 100', () => {
    expect(calculateRemainingTime(100, 100)).toBe(0);
  });

  it('should return 0 when progress is over 100', () => {
    expect(calculateRemainingTime(100, 150)).toBe(0);
  });

  it('should calculate remaining time correctly at 50%', () => {
    // If 100 seconds elapsed at 50%, total is 200, remaining is 100
    const remaining = calculateRemainingTime(100, 50);
    expect(remaining).toBe(100);
  });

  it('should calculate remaining time correctly at 25%', () => {
    // If 100 seconds elapsed at 25%, total is 400, remaining is 300
    const remaining = calculateRemainingTime(100, 25);
    expect(remaining).toBe(300);
  });

  it('should calculate remaining time correctly at 75%', () => {
    // If 75 seconds elapsed at 75%, total is 100, remaining is 25
    const remaining = calculateRemainingTime(75, 75);
    expect(Math.round(remaining)).toBe(25);
  });

  it('should never return negative time', () => {
    const remaining = calculateRemainingTime(1000, 99);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });
});
