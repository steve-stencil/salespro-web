/**
 * Report service.
 * Handles measurement report insertion into contract templates.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m sortContracts
 */
import { get, post } from '../lib/api-client';

import type {
  ReportDocument,
  ReportData,
  ReportInsertionConfig,
  AvailableReportsResult,
} from '../types/report';

/**
 * Report service methods.
 */
export const reportService = {
  /**
   * Get available reports for an estimate.
   * iOS: reportContract creation in sortContracts
   *
   * @param estimateId - Estimate ID
   * @returns Available reports with insertion config
   */
  getAvailableReports: async (
    estimateId: string,
  ): Promise<AvailableReportsResult> => {
    return get<AvailableReportsResult>(`/reports/${estimateId}/available`);
  },

  /**
   * Get report insertion configuration.
   *
   * @param companyId - Company ID
   * @returns Insertion config
   */
  getInsertionConfig: async (
    companyId: string,
  ): Promise<ReportInsertionConfig> => {
    return get<ReportInsertionConfig>(`/reports/config/${companyId}`);
  },

  /**
   * Generate report data for an estimate.
   *
   * @param estimateId - Estimate ID
   * @param reportType - Type of report to generate
   * @returns Generated report data
   */
  generateReport: async (
    estimateId: string,
    reportType: string,
  ): Promise<ReportData> => {
    return post<ReportData>(`/reports/${estimateId}/generate`, { reportType });
  },

  /**
   * Insert report documents into template list.
   * iOS: sortContracts creates reportContract
   *
   * @param templates - Current templates list (mutated in place)
   * @param reports - Reports to insert
   * @param config - Insertion configuration
   * @returns Updated templates list
   */
  insertReportsIntoTemplates: <
    T extends { categoryId: string; sortOrder: number },
  >(
    templates: T[],
    reports: ReportDocument[],
    config: ReportInsertionConfig,
  ): (T | ReportDocument)[] => {
    if (!config.enabled || reports.length === 0) {
      return templates;
    }

    // Find insertion point in target category
    const result: (T | ReportDocument)[] = [...templates];

    // Insert each report at the configured position
    reports.forEach((report, index) => {
      // Create report with correct category and sort order
      const insertableReport: ReportDocument = {
        ...report,
        categoryId: config.targetCategoryId,
        // Sort order places reports at the insertion position
        sortOrder: config.insertPosition + index * 0.1,
      };

      // Find where to insert based on category and sort order
      let insertIndex = result.findIndex(
        t =>
          t.categoryId === config.targetCategoryId &&
          t.sortOrder > insertableReport.sortOrder,
      );

      if (insertIndex === -1) {
        // No templates with higher sort order, append to end of category
        insertIndex = result.findIndex((t, i) => {
          const nextItem = result[i + 1];
          return (
            t.categoryId === config.targetCategoryId &&
            (i === result.length - 1 ||
              (nextItem && nextItem.categoryId !== config.targetCategoryId))
          );
        });
        if (insertIndex !== -1) {
          insertIndex += 1;
        } else {
          // Category not found, append to end
          insertIndex = result.length;
        }
      }

      result.splice(insertIndex, 0, insertableReport);
    });

    return result;
  },

  /**
   * Check if a template is a report document.
   *
   * @param template - Template to check
   * @returns True if template is a report
   */
  isReportDocument: (template: unknown): template is ReportDocument => {
    return (
      typeof template === 'object' &&
      template !== null &&
      'reportType' in template &&
      typeof (template as ReportDocument).reportType === 'string'
    );
  },
};
