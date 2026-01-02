/**
 * Pricing Export Service - exports option prices to Excel spreadsheet.
 * Streams directly to HTTP response for efficient memory usage.
 */

import ExcelJS from 'exceljs';

import {
  OptionPrice,
  PriceObjectType,
  PriceGuideOption,
  MeasureSheetItemOption,
  ItemTag,
  TaggableEntityType,
  Office,
} from '../../entities';

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Response } from 'express';

/**
 * Export filter options
 */
export type ExportOptions = {
  companyId: string;
  officeIds?: string[];
  optionIds?: string[];
  categoryIds?: string[];
  tagIds?: string[];
};

/**
 * Grouped price row for export
 */
type PriceRow = {
  optionId: string;
  optionName: string;
  brand: string | null;
  itemCode: string | null;
  officeId: string;
  officeName: string;
  /** Price amounts keyed by priceTypeId */
  prices: Record<string, number>;
  /** Calculated total */
  total: number;
};

/**
 * Get category IDs including all descendants (recursive).
 * Uses PostgreSQL recursive CTE for efficient tree traversal.
 */
async function getCategoryIdsWithDescendants(
  em: EntityManager,
  companyId: string,
  categoryIds: string[],
): Promise<string[]> {
  if (categoryIds.length === 0) return [];

  // Build placeholders for the IN clause (?, ?, ?, ...)
  const placeholders = categoryIds.map(() => '?').join(', ');

  const result = await em.getConnection().execute<{ id: string }[]>(
    `
    WITH RECURSIVE category_tree AS (
      -- Base case: selected categories
      SELECT id 
      FROM price_guide_category 
      WHERE id IN (${placeholders})
        AND company_id = ? 
        AND is_active = true
      
      UNION ALL
      
      -- Recursive case: children of categories in tree
      SELECT c.id 
      FROM price_guide_category c
      INNER JOIN category_tree ct ON c.parent_id = ct.id
      WHERE c.company_id = ? 
        AND c.is_active = true
    )
    SELECT DISTINCT id FROM category_tree
  `,
    [...categoryIds, companyId, companyId],
  );

  return result.map(r => r.id);
}

/**
 * Export option prices to Excel spreadsheet, streaming to HTTP response.
 * No files are stored on disk or S3.
 *
 * IMPORTANT: Exports ALL active options, not just those with prices.
 * Options without prices will show $0 for all price types.
 *
 * @param em - Entity manager
 * @param res - Express response object (streaming target)
 * @param options - Export filter options
 * @returns Number of rows exported
 */
export async function exportOptionPricesToResponse(
  em: EntityManager,
  res: Response,
  options: ExportOptions,
): Promise<number> {
  // 1. Get company's price types for column headers
  const priceTypes = await em.find(
    PriceObjectType,
    {
      company: options.companyId,
      isActive: true,
    },
    { orderBy: { sortOrder: 'ASC' } },
  );

  // 2. Get offices to export prices for
  const officeWhere: { company: string; id?: { $in: string[] } } = {
    company: options.companyId,
  };
  if (options.officeIds?.length) {
    officeWhere.id = { $in: options.officeIds };
  }
  const offices = await em.find(Office, officeWhere, {
    orderBy: { name: 'ASC' },
  });

  if (offices.length === 0) {
    // No offices - return empty spreadsheet
    const emptyWorkbook = new ExcelJS.Workbook();
    const emptySheet = emptyWorkbook.addWorksheet('Option Prices');
    emptySheet.columns = [{ header: 'No offices found', width: 30 }];

    const buffer = await emptyWorkbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="option-prices-${timestamp}.xlsx"`,
    );
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(Buffer.from(buffer));
    return 0;
  }

  // 3. Build option IDs filter from all sources
  let filteredOptionIds: string[] | undefined = options.optionIds
    ? [...options.optionIds]
    : undefined;

  // Filter by category: get options linked to MSIs in these categories
  // IMPORTANT: Cascades to include all descendant categories
  if (options.categoryIds?.length) {
    const allCategoryIds = await getCategoryIdsWithDescendants(
      em,
      options.companyId,
      options.categoryIds,
    );

    if (allCategoryIds.length > 0) {
      const msiOptions = await em.find(
        MeasureSheetItemOption,
        {
          measureSheetItem: {
            category: { id: { $in: allCategoryIds } },
            company: options.companyId,
            isActive: true,
          },
        },
        { fields: ['option.id'], populate: ['option'] },
      );

      const categoryOptionIds = [
        ...new Set(msiOptions.map(mo => mo.option.id)),
      ];

      if (filteredOptionIds) {
        filteredOptionIds = filteredOptionIds.filter(id =>
          categoryOptionIds.includes(id),
        );
      } else {
        filteredOptionIds = categoryOptionIds;
      }
    }
  }

  // Filter by tags: get options with these tags
  if (options.tagIds?.length) {
    const itemTags = await em.find(
      ItemTag,
      {
        tag: { id: { $in: options.tagIds } },
        entityType: TaggableEntityType.OPTION,
      },
      { fields: ['entityId'] },
    );

    const taggedOptionIds = [...new Set(itemTags.map(it => it.entityId))];

    if (filteredOptionIds) {
      filteredOptionIds = filteredOptionIds.filter(id =>
        taggedOptionIds.includes(id),
      );
    } else {
      filteredOptionIds = taggedOptionIds;
    }
  }

  // 4. Query ALL active options (not just those with prices)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optionWhere: any = {
    company: options.companyId,
    isActive: true,
  };

  if (filteredOptionIds?.length) {
    optionWhere.id = { $in: filteredOptionIds };
  } else if (filteredOptionIds?.length === 0) {
    // Filter resulted in empty set - return empty spreadsheet
    const emptyWorkbook = new ExcelJS.Workbook();
    const emptySheet = emptyWorkbook.addWorksheet('Option Prices');
    emptySheet.columns = [{ header: 'No matching options found', width: 30 }];

    const buffer = await emptyWorkbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="option-prices-${timestamp}.xlsx"`,
    );
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(Buffer.from(buffer));
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const allOptions = await em.find(PriceGuideOption, optionWhere, {
    orderBy: { name: 'ASC' },
  });

  if (allOptions.length === 0) {
    // No options - return empty spreadsheet
    const emptyWorkbook = new ExcelJS.Workbook();
    const emptySheet = emptyWorkbook.addWorksheet('Option Prices');
    emptySheet.columns = [{ header: 'No matching options found', width: 30 }];

    const buffer = await emptyWorkbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="option-prices-${timestamp}.xlsx"`,
    );
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(Buffer.from(buffer));
    return 0;
  }

  // 5. Query existing prices for these options
  const optionIds = allOptions.map(o => o.id);
  const officeIds = offices.map(o => o.id);

  const prices = await em.find(
    OptionPrice,
    {
      option: { id: { $in: optionIds } },
      office: { id: { $in: officeIds } },
    },
    {
      populate: ['option', 'office', 'priceType'],
    },
  );

  // 6. Build a price lookup map: optionId-officeId-priceTypeId -> amount
  const priceMap = new Map<string, number>();
  for (const price of prices) {
    const key = `${price.option.id}-${price.office.id}-${price.priceType.id}`;
    priceMap.set(key, Number(price.amount));
  }

  // 7. Generate rows for ALL option+office combinations
  const grouped: PriceRow[] = [];
  for (const option of allOptions) {
    for (const office of offices) {
      const row: PriceRow = {
        optionId: option.id,
        optionName: option.name,
        brand: option.brand ?? null,
        itemCode: option.itemCode ?? null,
        officeId: office.id,
        officeName: office.name,
        prices: {},
        total: 0,
      };

      // Get price for each price type (0 if not set)
      for (const pt of priceTypes) {
        const key = `${option.id}-${office.id}-${pt.id}`;
        row.prices[pt.id] = priceMap.get(key) ?? 0;
      }

      // Calculate total
      row.total = Object.values(row.prices).reduce((sum, val) => sum + val, 0);

      grouped.push(row);
    }
  }

  // 8. Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Option Prices');

  // 9. Define column structure
  const headers = [
    'Option Name',
    'Brand',
    'Item Code',
    'Office Name',
    ...priceTypes.map(pt => pt.name),
    'Total',
    'Option ID',
    'Office ID',
  ];

  const columnWidths = [
    25, // Option Name
    15, // Brand
    15, // Item Code
    20, // Office Name
    ...priceTypes.map(() => 12), // Price type columns
    12, // Total
    36, // Option ID
    36, // Office ID
  ];

  // 10. Build table rows with pre-calculated totals
  const tableRows: (string | number)[][] = [];
  for (const row of grouped) {
    const rowValues: (string | number)[] = [
      row.optionName,
      row.brand ?? '',
      row.itemCode ?? '',
      row.officeName,
    ];

    // Add price for each price type
    for (const pt of priceTypes) {
      rowValues.push(row.prices[pt.id] ?? 0);
    }

    // Add pre-calculated total, then IDs
    rowValues.push(row.total);
    rowValues.push(row.optionId);
    rowValues.push(row.officeId);

    tableRows.push(rowValues);
  }

  // 11. Create Excel Table with data
  worksheet.addTable({
    name: 'OptionPrices',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
    },
    columns: headers.map(name => ({ name, filterButton: true })),
    rows: tableRows,
  });

  // 12. Apply column widths (must be done after table creation)
  columnWidths.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
  });

  // 13. Replace Total values with formulas
  const priceStartColLetter = 'E';
  const priceEndColIndex = 4 + priceTypes.length;
  const priceEndColLetter = String.fromCharCode(64 + priceEndColIndex);
  const totalColIndex = 5 + priceTypes.length;

  for (let rowIndex = 0; rowIndex < grouped.length; rowIndex++) {
    const excelRowNum = rowIndex + 2; // +1 for 1-indexed, +1 for header
    const totalCell = worksheet.getCell(excelRowNum, totalColIndex);
    totalCell.value = {
      formula: `SUM(${priceStartColLetter}${excelRowNum}:${priceEndColLetter}${excelRowNum})`,
    };
  }

  // 14. Apply formatting
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Format price columns as currency (column E onwards through Total)
  const priceStartCol = 5; // Column E
  for (let colNum = priceStartCol; colNum <= totalColIndex; colNum++) {
    const col = worksheet.getColumn(colNum);
    col.numFmt = '$#,##0.00';
  }

  // 15. Write workbook to buffer and send response
  const buffer = await workbook.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().split('T')[0];

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="option-prices-${timestamp}.xlsx"`,
  );
  res.setHeader('Content-Length', buffer.byteLength);
  res.send(Buffer.from(buffer));

  return grouped.length;
}

/**
 * Get estimated row count for export preview (without actually exporting).
 *
 * IMPORTANT: Returns count of ALL option+office combinations, not just those with prices.
 *
 * @param em - Entity manager
 * @param options - Export filter options
 * @returns Estimated number of rows that would be exported
 */
export async function getExportRowCount(
  em: EntityManager,
  options: ExportOptions,
): Promise<number> {
  // 1. Get office count
  const officeWhere: { company: string; id?: { $in: string[] } } = {
    company: options.companyId,
  };
  if (options.officeIds?.length) {
    officeWhere.id = { $in: options.officeIds };
  }
  const officeCount = await em.count(Office, officeWhere);

  if (officeCount === 0) {
    return 0;
  }

  // 2. Build option filters
  let filteredOptionIds: string[] | undefined = options.optionIds
    ? [...options.optionIds]
    : undefined;

  if (options.categoryIds?.length) {
    const allCategoryIds = await getCategoryIdsWithDescendants(
      em,
      options.companyId,
      options.categoryIds,
    );

    if (allCategoryIds.length > 0) {
      const msiOptions = await em.find(
        MeasureSheetItemOption,
        {
          measureSheetItem: {
            category: { id: { $in: allCategoryIds } },
            company: options.companyId,
            isActive: true,
          },
        },
        { fields: ['option.id'], populate: ['option'] },
      );

      const categoryOptionIds = [
        ...new Set(msiOptions.map(mo => mo.option.id)),
      ];

      if (filteredOptionIds) {
        filteredOptionIds = filteredOptionIds.filter(id =>
          categoryOptionIds.includes(id),
        );
      } else {
        filteredOptionIds = categoryOptionIds;
      }
    }
  }

  if (options.tagIds?.length) {
    const itemTags = await em.find(
      ItemTag,
      {
        tag: { id: { $in: options.tagIds } },
        entityType: TaggableEntityType.OPTION,
      },
      { fields: ['entityId'] },
    );

    const taggedOptionIds = [...new Set(itemTags.map(it => it.entityId))];

    if (filteredOptionIds) {
      filteredOptionIds = filteredOptionIds.filter(id =>
        taggedOptionIds.includes(id),
      );
    } else {
      filteredOptionIds = taggedOptionIds;
    }
  }

  // 3. Count options
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optionWhere: any = {
    company: options.companyId,
    isActive: true,
  };

  if (filteredOptionIds?.length) {
    optionWhere.id = { $in: filteredOptionIds };
  } else if (filteredOptionIds?.length === 0) {
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const optionCount = await em.count(PriceGuideOption, optionWhere);

  // Return total combinations: options × offices
  return optionCount * officeCount;
}
