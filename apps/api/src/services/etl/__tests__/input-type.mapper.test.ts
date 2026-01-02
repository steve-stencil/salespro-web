/**
 * Input Type Mapper Tests
 *
 * Unit tests for the input type mapper functions.
 * Tests mapping of legacy input types to new AdditionalDetailInputType values.
 */

import { describe, it, expect } from 'vitest';

import {
  AdditionalDetailCellType,
  AdditionalDetailInputType,
  SizePickerPrecision,
} from '../../../entities/price-guide/types';
import {
  buildPhotoConfig,
  buildSizePickerConfig,
  buildUnitedInchConfig,
  mapCellType,
  mapInputType,
  normalizeDefaultValue,
  transformAdditionalDetail,
} from '../mappers/input-type.mapper';

import type { LegacyAdditionalDetailObject } from '../types';

describe('Input Type Mapper', () => {
  // ==========================================================================
  // mapInputType Tests
  // ==========================================================================

  describe('mapInputType', () => {
    it('should map "default" to TEXT', () => {
      const result = mapInputType('default');

      expect(result.inputType).toBe(AdditionalDetailInputType.TEXT);
    });

    it('should map "text" to TEXT', () => {
      const result = mapInputType('text');

      expect(result.inputType).toBe(AdditionalDetailInputType.TEXT);
    });

    it('should map "textView" to TEXTAREA', () => {
      const result = mapInputType('textView');

      expect(result.inputType).toBe(AdditionalDetailInputType.TEXTAREA);
    });

    it('should map "picker" to PICKER', () => {
      const result = mapInputType('picker');

      expect(result.inputType).toBe(AdditionalDetailInputType.PICKER);
    });

    it('should map "multiSelectPicker" to PICKER', () => {
      const result = mapInputType('multiSelectPicker');

      expect(result.inputType).toBe(AdditionalDetailInputType.PICKER);
    });

    it('should map "keypad" to NUMBER without decimal', () => {
      const result = mapInputType('keypad');

      expect(result.inputType).toBe(AdditionalDetailInputType.NUMBER);
      expect(result.allowDecimal).toBe(false);
    });

    it('should map "numberKeyboard" to NUMBER with decimal', () => {
      const result = mapInputType('numberKeyboard');

      expect(result.inputType).toBe(AdditionalDetailInputType.NUMBER);
      expect(result.allowDecimal).toBe(true);
    });

    it('should map "currency" to CURRENCY with decimal', () => {
      const result = mapInputType('currency');

      expect(result.inputType).toBe(AdditionalDetailInputType.CURRENCY);
      expect(result.allowDecimal).toBe(true);
    });

    it('should map "currencyWhole" to CURRENCY without decimal', () => {
      const result = mapInputType('currencyWhole');

      expect(result.inputType).toBe(AdditionalDetailInputType.CURRENCY);
      expect(result.allowDecimal).toBe(false);
    });

    it('should map "sizePickerInch" to SIZE_PICKER with inch precision', () => {
      const result = mapInputType('sizePickerInch');

      expect(result.inputType).toBe(AdditionalDetailInputType.SIZE_PICKER);
      expect(result.precision).toBe(SizePickerPrecision.INCH);
    });

    it('should map "sizePickerQuarterInch" to SIZE_PICKER with quarter inch precision', () => {
      const result = mapInputType('sizePickerQuarterInch');

      expect(result.inputType).toBe(AdditionalDetailInputType.SIZE_PICKER);
      expect(result.precision).toBe(SizePickerPrecision.QUARTER_INCH);
    });

    it('should map "3DSizePickerEighthInch" to SIZE_PICKER_3D with eighth inch precision', () => {
      const result = mapInputType('3DSizePickerEighthInch');

      expect(result.inputType).toBe(AdditionalDetailInputType.SIZE_PICKER_3D);
      expect(result.precision).toBe(SizePickerPrecision.EIGHTH_INCH);
    });

    it('should map "unitedInchPicker" to UNITED_INCH', () => {
      const result = mapInputType('unitedInchPicker');

      expect(result.inputType).toBe(AdditionalDetailInputType.UNITED_INCH);
    });

    it('should map "datePicker" to DATE', () => {
      const result = mapInputType('datePicker');

      expect(result.inputType).toBe(AdditionalDetailInputType.DATE);
    });

    it('should map "timePicker" to TIME', () => {
      const result = mapInputType('timePicker');

      expect(result.inputType).toBe(AdditionalDetailInputType.TIME);
    });

    it('should map "dateTimePicker" to DATETIME', () => {
      const result = mapInputType('dateTimePicker');

      expect(result.inputType).toBe(AdditionalDetailInputType.DATETIME);
    });

    it('should map unknown types to TEXT with warning', () => {
      const result = mapInputType('unknownType');

      expect(result.inputType).toBe(AdditionalDetailInputType.TEXT);
    });
  });

  // ==========================================================================
  // mapCellType Tests
  // ==========================================================================

  describe('mapCellType', () => {
    it('should map "photos" to PHOTOS', () => {
      const result = mapCellType('photos');

      expect(result).toBe(AdditionalDetailCellType.PHOTOS);
    });

    it('should map "photo" to PHOTOS', () => {
      const result = mapCellType('photo');

      expect(result).toBe(AdditionalDetailCellType.PHOTOS);
    });

    it('should map "text" to TEXT', () => {
      const result = mapCellType('text');

      expect(result).toBe(AdditionalDetailCellType.TEXT);
    });

    it('should map "default" to TEXT', () => {
      const result = mapCellType('default');

      expect(result).toBe(AdditionalDetailCellType.TEXT);
    });

    it('should return undefined for undefined input', () => {
      const result = mapCellType(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown cell types', () => {
      const result = mapCellType('unknownCellType');

      expect(result).toBeUndefined();
    });

    it('should be case insensitive', () => {
      expect(mapCellType('PHOTOS')).toBe(AdditionalDetailCellType.PHOTOS);
      expect(mapCellType('Photos')).toBe(AdditionalDetailCellType.PHOTOS);
    });
  });

  // ==========================================================================
  // buildSizePickerConfig Tests
  // ==========================================================================

  describe('buildSizePickerConfig', () => {
    it('should build complete size picker config', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Size',
        inputType: 'sizePickerQuarterInch',
        minSizePickerWidth: 10,
        maxSizePickerWidth: 100,
        minSizePickerHeight: 5,
        maxSizePickerHeight: 50,
      };

      const result = buildSizePickerConfig(
        legacy,
        SizePickerPrecision.QUARTER_INCH,
      );

      expect(result.precision).toBe(SizePickerPrecision.QUARTER_INCH);
      expect(result.minWidth).toBe(10);
      expect(result.maxWidth).toBe(100);
      expect(result.minHeight).toBe(5);
      expect(result.maxHeight).toBe(50);
    });

    it('should include depth for 3D pickers', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: '3D Size',
        inputType: '3DSizePickerInch',
        minSizePickerDepth: 1,
        maxSizePickerDepth: 10,
      };

      const result = buildSizePickerConfig(legacy, SizePickerPrecision.INCH);

      expect(result.minDepth).toBe(1);
      expect(result.maxDepth).toBe(10);
    });

    it('should handle missing optional fields', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Size',
        inputType: 'sizePickerInch',
      };

      const result = buildSizePickerConfig(legacy, SizePickerPrecision.INCH);

      expect(result.precision).toBe(SizePickerPrecision.INCH);
      expect(result.minWidth).toBeUndefined();
      expect(result.maxWidth).toBeUndefined();
    });
  });

  // ==========================================================================
  // buildUnitedInchConfig Tests
  // ==========================================================================

  describe('buildUnitedInchConfig', () => {
    it('should build united inch config with suffix', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'United Inch',
        inputType: 'unitedInchPicker',
        unitedInchSuffix: 'UI',
      };

      const result = buildUnitedInchConfig(legacy);

      expect(result?.suffix).toBe('UI');
    });

    it('should return undefined when no suffix', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'United Inch',
        inputType: 'unitedInchPicker',
      };

      const result = buildUnitedInchConfig(legacy);

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // buildPhotoConfig Tests
  // ==========================================================================

  describe('buildPhotoConfig', () => {
    it('should build photo config with disableTemplatePhotoLinking', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Photos',
        inputType: 'default',
        cellType: 'photos',
        disableTemplatePhotoLinking: true,
      };

      const result = buildPhotoConfig(legacy);

      expect(result?.disableTemplatePhotoLinking).toBe(true);
    });

    it('should return undefined when disableTemplatePhotoLinking not set', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Photos',
        inputType: 'default',
        cellType: 'photos',
      };

      const result = buildPhotoConfig(legacy);

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // normalizeDefaultValue Tests
  // ==========================================================================

  describe('normalizeDefaultValue', () => {
    it('should return string value unchanged', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Test',
        inputType: 'default',
        defaultValue: 'hello',
      };

      const result = normalizeDefaultValue(legacy);

      expect(result).toBe('hello');
    });

    it('should convert array to JSON string', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Test',
        inputType: 'picker',
        defaultValue: ['option1', 'option2'],
      };

      const result = normalizeDefaultValue(legacy);

      expect(result).toBe('["option1","option2"]');
    });

    it('should return undefined for undefined defaultValue', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Test',
        inputType: 'default',
      };

      const result = normalizeDefaultValue(legacy);

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // transformAdditionalDetail Tests
  // ==========================================================================

  describe('transformAdditionalDetail', () => {
    it('should transform complete legacy additional detail', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'legacy-123',
        title: 'Test Field',
        inputType: 'picker',
        required: true,
        shouldCopy: true,
        placeholder: 'Select an option',
        note: 'Helper text',
        defaultValue: 'option1',
        notAddedReplacement: 'N/A',
        pickerValues: ['option1', 'option2', 'option3'],
      };

      const result = transformAdditionalDetail(legacy);

      expect(result.sourceId).toBe('legacy-123');
      expect(result.title).toBe('Test Field');
      expect(result.inputType).toBe(AdditionalDetailInputType.PICKER);
      expect(result.isRequired).toBe(true);
      expect(result.shouldCopy).toBe(true);
      expect(result.placeholder).toBe('Select an option');
      expect(result.note).toBe('Helper text');
      expect(result.defaultValue).toBe('option1');
      expect(result.notAddedReplacement).toBe('N/A');
      expect(result.pickerValues).toEqual(['option1', 'option2', 'option3']);
    });

    it('should transform size picker with config', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'size-1',
        title: 'Window Size',
        inputType: 'sizePickerQuarterInch',
        minSizePickerWidth: 12,
        maxSizePickerWidth: 96,
        minSizePickerHeight: 12,
        maxSizePickerHeight: 72,
      };

      const result = transformAdditionalDetail(legacy);

      expect(result.inputType).toBe(AdditionalDetailInputType.SIZE_PICKER);
      expect(result.sizePickerConfig).toBeDefined();
      expect(result.sizePickerConfig?.precision).toBe(
        SizePickerPrecision.QUARTER_INCH,
      );
      expect(result.sizePickerConfig?.minWidth).toBe(12);
      expect(result.sizePickerConfig?.maxWidth).toBe(96);
    });

    it('should transform 3D size picker with config', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: '3d-1',
        title: 'Box Size',
        inputType: '3DSizePickerEighthInch',
        minSizePickerWidth: 1,
        maxSizePickerWidth: 48,
        minSizePickerHeight: 1,
        maxSizePickerHeight: 48,
        minSizePickerDepth: 1,
        maxSizePickerDepth: 24,
      };

      const result = transformAdditionalDetail(legacy);

      expect(result.inputType).toBe(AdditionalDetailInputType.SIZE_PICKER_3D);
      expect(result.sizePickerConfig?.precision).toBe(
        SizePickerPrecision.EIGHTH_INCH,
      );
      expect(result.sizePickerConfig?.minDepth).toBe(1);
      expect(result.sizePickerConfig?.maxDepth).toBe(24);
    });

    it('should transform united inch picker with config', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'ui-1',
        title: 'United Inch',
        inputType: 'unitedInchPicker',
        unitedInchSuffix: 'UI',
      };

      const result = transformAdditionalDetail(legacy);

      expect(result.inputType).toBe(AdditionalDetailInputType.UNITED_INCH);
      expect(result.unitedInchConfig?.suffix).toBe('UI');
    });

    it('should transform photo field with config', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'photo-1',
        title: 'Photos',
        inputType: 'default',
        cellType: 'photos',
        disableTemplatePhotoLinking: true,
      };

      const result = transformAdditionalDetail(legacy);

      expect(result.cellType).toBe(AdditionalDetailCellType.PHOTOS);
      expect(result.photoConfig?.disableTemplatePhotoLinking).toBe(true);
    });

    it('should handle date/time fields with display format', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'date-1',
        title: 'Install Date',
        inputType: 'datePicker',
        dateDisplayFormat: 'MM/dd/yyyy',
      };

      const result = transformAdditionalDetail(legacy);

      expect(result.inputType).toBe(AdditionalDetailInputType.DATE);
      expect(result.dateDisplayFormat).toBe('MM/dd/yyyy');
    });

    it('should default boolean fields appropriately', () => {
      const legacy: LegacyAdditionalDetailObject = {
        objectId: 'test-1',
        title: 'Test',
        inputType: 'default',
      };

      const result = transformAdditionalDetail(legacy);

      expect(result.isRequired).toBe(false);
      expect(result.shouldCopy).toBe(false);
      expect(result.allowDecimal).toBe(false);
    });
  });
});
