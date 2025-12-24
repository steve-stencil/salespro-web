/**
 * Imported PDF document types for iOS parity.
 * Based on iOS source: ContractObjectSelectionCollectionViewController.m
 * documentPicker:didPickDocumentsAtURLs:
 */

/**
 * An imported PDF document from device.
 */
export type ImportedPdfDocument = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Local file URI. */
  localUri: string;
  /** Generated thumbnail for display. */
  thumbnailDataUrl?: string;
  /** Number of pages in the PDF. */
  pageCount: number;
  /** Whether this document is selected for inclusion. */
  isSelected: boolean;
  importedAt: string;
};

/**
 * Result of importing a PDF document.
 */
export type ImportPdfResult = {
  success: boolean;
  document?: ImportedPdfDocument;
  errorMessage?: string;
};

/**
 * Multi-select import result.
 */
export type MultiImportResult = {
  successCount: number;
  failureCount: number;
  documents: ImportedPdfDocument[];
  errors: ImportError[];
};

/**
 * Import error details.
 */
export type ImportError = {
  fileName: string;
  reason: 'invalid_format' | 'too_large' | 'corrupted' | 'read_error';
  message: string;
};

/**
 * PDF page extraction options.
 */
export type PageExtractionOptions = {
  /** Pages to extract (1-indexed). Empty means all pages. */
  pageNumbers?: number[];
  /** Whether to generate thumbnails for extracted pages. */
  generateThumbnails: boolean;
};

/**
 * Extracted page from an imported PDF.
 */
export type ExtractedPage = {
  pageNumber: number;
  thumbnailDataUrl?: string;
  /** Whether this page is selected for inclusion. */
  isSelected: boolean;
};
