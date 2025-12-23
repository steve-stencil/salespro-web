/**
 * ETL Transform Functions
 *
 * Functions for transforming Parse document data to our database schema.
 */

import type { RawDocumentObject, TransformedTemplateData } from './types';
import type { DocumentDataJson } from '../../entities';

/**
 * Parse page size string "width,height" into components.
 * Returns default Letter size (612x792) if invalid.
 */
export function parsePageSize(pageSizeStr: string | undefined): {
  width: number;
  height: number;
} {
  if (!pageSizeStr || typeof pageSizeStr !== 'string') {
    return { width: 612, height: 792 };
  }

  const parts = pageSizeStr.split(',').map(s => parseInt(s.trim(), 10));
  const width = parts[0];
  const height = parts[1];

  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    Number.isNaN(width) ||
    Number.isNaN(height)
  ) {
    return { width: 612, height: 792 };
  }

  return { width, height };
}

/**
 * Check if contractData contains user input required sections.
 * Mirrors iOS: containsUserInputRequiredSection
 */
export function hasUserInputRequired(contractData: DocumentDataJson): boolean {
  for (const group of contractData) {
    if (group.groupType === 'body' && Array.isArray(group.data)) {
      for (const section of group.data) {
        const sectionObj = section as Record<string, unknown>;
        if (sectionObj['userInputRequired'] === true) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Count signature and initials fields in contractData.
 */
export function countSignatureFields(contractData: DocumentDataJson): {
  signatures: number;
  initials: number;
} {
  let signatures = 0;
  let initials = 0;

  function scanCellItems(items: unknown[]): void {
    for (const item of items) {
      const cell = item as Record<string, unknown>;
      const cellType = cell['cellType'] as string | undefined;

      if (cellType === 'signature') {
        signatures++;
      }
      if (cell['initialsRequired'] === true) {
        initials++;
      }

      // Recursively check detailItems
      if (Array.isArray(cell['detailItems'])) {
        scanCellItems(cell['detailItems'] as unknown[]);
      }
    }
  }

  for (const group of contractData) {
    if (Array.isArray(group.data)) {
      for (const section of group.data) {
        const sectionObj = section as Record<string, unknown>;

        // Sections have nested cellItems arrays
        if (Array.isArray(sectionObj['cellItems'])) {
          const cellItems = sectionObj['cellItems'] as unknown[];
          for (const row of cellItems) {
            if (Array.isArray(row)) {
              scanCellItems(row);
            } else {
              scanCellItems([row]);
            }
          }
        }
      }
    }
  }

  return { signatures, initials };
}

/**
 * Clamp watermark alpha to valid range [0, 1].
 */
export function clampWatermarkAlpha(alpha: number | undefined): number {
  if (alpha === undefined || typeof alpha !== 'number' || Number.isNaN(alpha)) {
    return 0.05; // Default
  }
  return Math.max(0, Math.min(1, alpha));
}

/**
 * Transform raw Parse document object to our database schema.
 */
export function transformToTemplate(
  raw: RawDocumentObject,
): TransformedTemplateData {
  const pageSize = parsePageSize(raw.pageSize);
  const contractData = raw.contractData ?? [];
  const { signatures, initials } = countSignatureFields(contractData);

  // Extract source office IDs from Parse pointers
  const sourceOfficeIds = (raw.includedOffices ?? [])
    .map(o => o.objectId)
    .filter(Boolean);

  return {
    categoryName: raw.category ?? '',
    sourceOfficeIds,
    sourceType: raw.type ?? 'contract',
    sourceTemplateId: raw.objectId,
    pageId: raw.pageId ?? 'singlePage',
    displayName: raw.displayName ?? 'Untitled',
    sortOrder: raw.order ?? 0,
    canAddMultiplePages: raw.canAddMultiplePages ?? false,
    isTemplate: raw.isTemplate ?? false,
    includedStates: raw.includedStates ?? [],
    pageWidth: pageSize.width,
    pageHeight: pageSize.height,
    hMargin: raw.hMargin ?? 35,
    wMargin: raw.wMargin ?? 20,
    photosPerPage: raw.photosPerPage ?? 1,
    useWatermark: raw.useWatermark ?? false,
    watermarkWidthPercent: raw.watermarkWidthPercent ?? 100,
    watermarkAlpha: clampWatermarkAlpha(raw.watermarkAlpha),
    documentDataJson: contractData,
    imageUrls: (raw.images ?? [])
      .map(img => img.url)
      .filter(
        (url): url is string => typeof url === 'string' && url.length > 0,
      ),
    hasUserInput: hasUserInputRequired(contractData),
    signatureFieldCount: signatures,
    initialsFieldCount: initials,
    pdfUrl: raw.pdf?.url,
    iconUrl: raw.iconImage?.url,
    watermarkUrl: raw.watermark?.url,
  };
}
