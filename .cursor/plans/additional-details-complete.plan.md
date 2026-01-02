# Additional Details Fields - Implementation Plan

## Overview

This plan completes the Additional Detail Fields feature for the price guide library. Additional Detail Fields are custom input fields (text, picker, size picker, dates, etc.) that can be attached to Measure Sheet Items (MSIs) and UpCharges to capture extra information during estimates.

## Current State

### ✅ Already Implemented

- Backend entity: `AdditionalDetailField.entity.ts` with all field types
- Junction tables: `MeasureSheetItemAdditionalDetailField`, `UpChargeAdditionalDetailField`
- DB triggers for `linkedMsiCount` and `linkedUpChargeCount`
- Library CRUD routes: `/price-guide/library/additional-details`
- MSI linking routes: `/price-guide/measure-sheet-items/:id/additional-details`
- Frontend library tab with basic create/edit dialogs

### ❌ Missing

- UpCharge linking API routes
- 3 input types missing from frontend (size_picker, size_picker_3d, united_inch)
- Type-specific configuration forms (picker values, size constraints, etc.)
- General fields in dialogs (placeholder, note, defaultValue, etc.)
- UpCharge edit UI for additional details

## Key Files

### Backend

- Entity: `apps/api/src/entities/price-guide/AdditionalDetailField.entity.ts`
- Types: `apps/api/src/entities/price-guide/types.ts`
- Library routes: `apps/api/src/routes/price-guide/library/additional-details.routes.ts`
- UpCharge routes: `apps/api/src/routes/price-guide/library/upcharges.routes.ts`

### Frontend

- Library page: `apps/web/src/pages/price-guide/LibraryPage.tsx`
- MSI section: `apps/web/src/pages/price-guide/sections/AdditionalDetailsSection.tsx`
- Services: `apps/web/src/services/price-guide.ts`
- Hooks: `apps/web/src/hooks/usePriceGuide.ts`

## Input Types Reference

| Input Type     | Value            | Config Fields             |
| -------------- | ---------------- | ------------------------- |
| Text           | `text`           | -                         |
| Text Area      | `textarea`       | -                         |
| Number         | `number`         | `allowDecimal`            |
| Currency       | `currency`       | `allowDecimal`            |
| Picker         | `picker`         | `pickerValues[]`          |
| Size Picker    | `size_picker`    | `sizePickerConfig`        |
| Size Picker 3D | `size_picker_3d` | `sizePickerConfig`        |
| Date           | `date`           | `dateDisplayFormat`       |
| Time           | `time`           | `dateDisplayFormat`       |
| DateTime       | `datetime`       | `dateDisplayFormat`       |
| United Inch    | `united_inch`    | `unitedInchConfig.suffix` |

## Phase Summary

| Phase | Focus                          | Status      |
| ----- | ------------------------------ | ----------- |
| 1     | Backend - UpCharge linking API | ✅ Complete |
| 2     | Frontend - Enhanced dialogs    | ✅ Complete |
| 3     | Quality Assurance              | ✅ Complete |

## Phase 1: Backend - UpCharge Linking API

### Routes to Add

1. `GET /price-guide/library/upcharges/:id/additional-details` - List linked fields
2. `POST /price-guide/library/upcharges/:id/additional-details` - Link fields
3. `DELETE /price-guide/library/upcharges/:id/additional-details/:fieldId` - Unlink field
4. `PUT /price-guide/library/upcharges/:id/additional-details/order` - Reorder fields

## Phase 2: Frontend Enhancements

### Add Missing Input Types

Add to `INPUT_TYPE_OPTIONS` in `LibraryPage.tsx`:

- `size_picker` - Size Picker (2D)
- `size_picker_3d` - Size Picker (3D)
- `united_inch` - United Inch

### Type-Specific Configuration

For each input type, add configuration fields:

**Picker:**

- `pickerValues` - Array of picker options (text input to add/remove values)

**Number/Currency:**

- `allowDecimal` - Boolean toggle

**Size Picker (2D/3D):**

- `precision` - Dropdown (inch, quarter_inch, eighth_inch, sixteenth_inch)
- `minWidth`, `maxWidth`, `minHeight`, `maxHeight` - Number inputs
- For 3D: `minDepth`, `maxDepth` - Number inputs

**Date/Time/DateTime:**

- `dateDisplayFormat` - Text input for format string

**United Inch:**

- `unitedInchConfig.suffix` - Text input for suffix

### General Fields

Add to all dialogs:

- `placeholder` - Input placeholder text
- `note` - Helper text for the field
- `defaultValue` - Default value
- `notAddedReplacement` - Text shown when value is empty
