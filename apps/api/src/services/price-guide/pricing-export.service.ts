/**
 * Pricing Export Service - exports option prices to Excel spreadsheet.
 * Streams directly to HTTP response for efficient memory usage.
 */

import ExcelJS from 'exceljs';

import {
  OptionPrice,
  PriceObjectType,
  MeasureSheetItemOption,
  ItemTag,
  TaggableEntityType,
} from '../../entities';

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Column } from 'exceljs';
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

  const result = await em.getConnection().execute<{ id: string }[]>(
    `
    WITH RECURSIVE category_tree AS (
      -- Base case: selected categories
      SELECT id 
      FROM price_guide_category 
      WHERE id = ANY($1::uuid[]) 
        AND company_id = $2 
        AND is_active = true
      
      UNION ALL
      
      -- Recursive case: children of categories in tree
      SELECT c.id 
      FROM price_guide_category c
      INNER JOIN category_tree ct ON c.parent_id = ct.id
      WHERE c.company_id = $2 
        AND c.is_active = true
    )
    SELECT DISTINCT id FROM category_tree
  `,
    [categoryIds, companyId],
  );

  return result.map(r => r.id);
}

/**
 * Group prices by option+office combination.
 */
function groupPricesByOptionAndOffice(
  prices: OptionPrice[],
  priceTypes: PriceObjectType[],
): PriceRow[] {
  const grouped = new Map<string, PriceRow>();

  for (const price of prices) {
    const key = `${price.option.id}-${price.office.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        optionId: price.option.id,
        optionName: price.option.name,
        brand: price.option.brand ?? null,
        itemCode: price.option.itemCode ?? null,
        officeId: price.office.id,
        officeName: price.office.name,
        prices: {},
        total: 0,
      });

      // Initialize all price types with 0
      for (const pt of priceTypes) {
        grouped.get(key)!.prices[pt.id] = 0;
      }
    }

    const row = grouped.get(key)!;
    row.prices[price.priceType.id] = Number(price.amount);
  }

  // Calculate totals
  for (const row of grouped.values()) {
    row.total = Object.values(row.prices).reduce((sum, val) => sum + val, 0);
  }

  return Array.from(grouped.values());
}

/**
 * Export option prices to Excel spreadsheet, streaming to HTTP response.
 * No files are stored on disk or S3.
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

  // 2. Build option IDs filter from all sources
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

  // 3. Query prices with filters
  // Build where clause dynamically for MikroORM
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    option: { company: options.companyId, isActive: true },
  };

  if (options.officeIds?.length) {
    whereClause.office = { id: { $in: options.officeIds } };
  }

  if (filteredOptionIds?.length) {
    whereClause.option.id = { $in: filteredOptionIds };
  } else if (filteredOptionIds?.length === 0) {
    // Filter resulted in empty set - return empty spreadsheet
    // Set headers for empty file and return
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="option-prices-${timestamp}.xlsx"`,
    );

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
    });

    const worksheet = workbook.addWorksheet('Option Prices');
    worksheet.columns = [{ header: 'No matching options found', width: 30 }];
    await workbook.commit();
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const prices = await em.find(OptionPrice, whereClause, {
    populate: ['option', 'office', 'priceType'],
    orderBy: { option: { name: 'ASC' }, office: { name: 'ASC' } },
  });

  // 4. Group prices by option+office
  const grouped = groupPricesByOptionAndOffice(prices, priceTypes);

  // 5. Set response headers
  const timestamp = new Date().toISOString().split('T')[0];
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="option-prices-${timestamp}.xlsx"`,
  );

  // 6. Create streaming workbook that writes directly to response
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
  });

  const worksheet = workbook.addWorksheet('Option Prices');

  // 7. Define columns
  const columns: Partial<Column>[] = [
    { header: 'Option Name', key: 'optionName', width: 25 },
    { header: 'Brand', key: 'brand', width: 15 },
    { header: 'Item Code', key: 'itemCode', width: 15 },
    { header: 'Office Name', key: 'officeName', width: 20 },
    ...priceTypes.map(pt => ({
      header: pt.name,
      key: pt.id,
      width: 12,
    })),
    { header: 'Total', key: 'total', width: 12 },
    {
      header: 'Option ID',
      key: 'optionId',
      width: 12,
      outlineLevel: 1,
    },
    {
      header: 'Office ID',
      key: 'officeId',
      width: 12,
      outlineLevel: 1,
    },
  ];
  worksheet.columns = columns;

  // 8. Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E5E5' },
  };
  headerRow.commit();

  // 9. Write data rows
  for (const row of grouped) {
    const rowData: Record<string, unknown> = {
      optionName: row.optionName,
      brand: row.brand ?? '',
      itemCode: row.itemCode ?? '',
      officeName: row.officeName,
      total: row.total,
      optionId: row.optionId,
      officeId: row.officeId,
    };

    // Add price for each price type
    for (const pt of priceTypes) {
      rowData[pt.id] = row.prices[pt.id] ?? 0;
    }

    worksheet.addRow(rowData).commit();
  }

  // 10. Apply formatting
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Format price columns as currency
  const priceStartCol = 5; // After Office Name
  for (let i = priceStartCol; i <= priceStartCol + priceTypes.length; i++) {
    const col = worksheet.getColumn(i);
    col.numFmt = '$#,##0.00';
  }

  // Collapse ID columns (grouped)
  worksheet.properties.outlineLevelCol = 1;

  // 11. Finalize and close stream
  await workbook.commit();

  return grouped.length;
}

/**
 * Get estimated row count for export preview (without actually exporting).
 *
 * @param em - Entity manager
 * @param options - Export filter options
 * @returns Estimated number of rows that would be exported
 */
export async function getExportRowCount(
  em: EntityManager,
  options: ExportOptions,
): Promise<number> {
  // Build the same filters as export but just count
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    option: { company: options.companyId, isActive: true },
  };

  if (options.officeIds?.length) {
    whereClause.office = { id: { $in: options.officeIds } };
  }

  if (filteredOptionIds?.length) {
    whereClause.option.id = { $in: filteredOptionIds };
  } else if (filteredOptionIds?.length === 0) {
    return 0;
  }

  // Count unique option+office combinations
  const result = await em.getConnection().execute<{ count: string }[]>(
    `
    SELECT COUNT(DISTINCT (op.option_id, op.office_id)) as count
    FROM option_price op
    JOIN price_guide_option pgo ON op.option_id = pgo.id
    WHERE pgo.company_id = $1 
      AND pgo.is_active = true
      ${options.officeIds?.length ? `AND op.office_id = ANY($2::uuid[])` : ''}
      ${filteredOptionIds?.length ? `AND op.option_id = ANY($3::uuid[])` : ''}
  `,
    [
      options.companyId,
      options.officeIds?.length ? options.officeIds : null,
      filteredOptionIds?.length ? filteredOptionIds : null,
    ].filter(Boolean),
  );

  return parseInt(result[0]?.count ?? '0', 10);
}
