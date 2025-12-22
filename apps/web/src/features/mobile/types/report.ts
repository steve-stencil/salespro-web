/**
 * Report document insertion types for iOS parity.
 * Based on iOS source: ContractObjectSelectionCollectionViewController.m sortContracts
 */

/**
 * A measurement report template auto-inserted into documents.
 * Based on iOS reportContract creation.
 */
export type ReportDocument = {
  id: string;
  name: string;
  /** The report type (e.g., 'measurement', 'inspection'). */
  reportType: string;
  /** Category where this report is inserted. */
  categoryId: string;
  /** Sort order for positioning within category. */
  sortOrder: number;
  /** Whether the report is enabled by config. */
  isEnabled: boolean;
  /** Generated report data. */
  reportData?: ReportData;
  /** Thumbnail for display. */
  thumbnailUrl?: string;
  /** Whether this report is selected for inclusion. */
  isSelected: boolean;
};

/**
 * Generated report data from measurement system.
 */
export type ReportData = {
  estimateId: string;
  generatedAt: string;
  /** Report content as HTML or PDF data. */
  content: string;
  contentType: 'html' | 'pdf';
  /** Page count if PDF. */
  pageCount?: number;
};

/**
 * Report insertion configuration.
 * Determines whether and where reports are auto-inserted.
 */
export type ReportInsertionConfig = {
  /** Whether report insertion is enabled. */
  enabled: boolean;
  /** Category ID where reports should be inserted. */
  targetCategoryId: string;
  /** Position within category (0 = first). */
  insertPosition: number;
  /** Report types to auto-insert. */
  reportTypes: string[];
};

/**
 * Result of checking for available reports.
 */
export type AvailableReportsResult = {
  hasReports: boolean;
  reports: ReportDocument[];
  insertionConfig: ReportInsertionConfig;
};
