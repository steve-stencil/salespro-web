/**
 * PDF Import service.
 * Handles importing PDF documents from device.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 * documentPicker:didPickDocumentsAtURLs:
 */
import type {
  ImportedPdfDocument,
  ImportPdfResult,
  MultiImportResult,
  ImportError,
  PageExtractionOptions,
  ExtractedPage,
} from '../types/import';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['application/pdf'];

/**
 * PDF Import service methods.
 */
export const importService = {
  /**
   * Validate a file for import.
   *
   * @param file - File to validate
   * @returns Validation error or null if valid
   */
  validateFile: (file: File): ImportError | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        fileName: file.name,
        reason: 'invalid_format',
        message: 'Only PDF files are supported.',
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        fileName: file.name,
        reason: 'too_large',
        message: 'File is too large. Maximum size is 50MB.',
      };
    }

    return null;
  },

  /**
   * Import a single PDF document.
   * iOS: documentPicker:didPickDocumentsAtURLs:
   *
   * @param file - PDF file to import
   * @returns Import result
   */
  importPdf: async (file: File): Promise<ImportPdfResult> => {
    const validationError = importService.validateFile(file);
    if (validationError) {
      return {
        success: false,
        errorMessage: validationError.message,
      };
    }

    try {
      // Create object URL for local access
      const localUri = URL.createObjectURL(file);

      // Generate thumbnail (placeholder - would use pdf.js in production)
      const thumbnailDataUrl = await importService.generateThumbnail(file);

      // Get page count (placeholder - would use pdf.js in production)
      const pageCount = await importService.getPageCount(file);

      const document: ImportedPdfDocument = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        localUri,
        thumbnailDataUrl,
        pageCount,
        isSelected: true, // Auto-select imported documents
        importedAt: new Date().toISOString(),
      };

      return {
        success: true,
        document,
      };
    } catch (error) {
      console.error('Failed to import PDF:', error);
      return {
        success: false,
        errorMessage: 'Failed to read PDF file.',
      };
    }
  },

  /**
   * Import multiple PDF documents.
   * iOS: documentPicker with multi-select
   *
   * @param files - PDF files to import
   * @returns Multi-import result
   */
  importMultiplePdfs: async (files: File[]): Promise<MultiImportResult> => {
    const results = await Promise.all(
      files.map(file => importService.importPdf(file)),
    );

    const documents: ImportedPdfDocument[] = [];
    const errors: ImportError[] = [];

    results.forEach((result, index) => {
      if (result.success && result.document) {
        documents.push(result.document);
      } else {
        const file = files[index];
        if (file) {
          errors.push({
            fileName: file.name,
            reason: 'read_error',
            message: result.errorMessage ?? 'Unknown error',
          });
        }
      }
    });

    return {
      successCount: documents.length,
      failureCount: errors.length,
      documents,
      errors,
    };
  },

  /**
   * Generate a thumbnail for a PDF.
   * Placeholder - would use pdf.js canvas rendering in production.
   *
   * @param _file - PDF file
   * @returns Thumbnail as data URL
   */
  generateThumbnail: (_file: File): Promise<string | undefined> => {
    // TODO: Implement with pdf.js
    // For now, return undefined (no thumbnail)
    return Promise.resolve(undefined);
  },

  /**
   * Get page count from a PDF.
   * Placeholder - would use pdf.js in production.
   *
   * @param _file - PDF file
   * @returns Page count
   */
  getPageCount: (_file: File): Promise<number> => {
    // TODO: Implement with pdf.js
    // For now, return 1 as default
    return Promise.resolve(1);
  },

  /**
   * Extract specific pages from a PDF.
   *
   * @param document - Imported document
   * @param options - Extraction options
   * @returns Extracted pages
   */
  extractPages: (
    document: ImportedPdfDocument,
    options: PageExtractionOptions,
  ): Promise<ExtractedPage[]> => {
    const pages: ExtractedPage[] = [];

    // If no specific pages requested, return all pages
    const pageNumbers =
      options.pageNumbers ??
      Array.from({ length: document.pageCount }, (_, i) => i + 1);

    for (const pageNumber of pageNumbers) {
      pages.push({
        pageNumber,
        thumbnailDataUrl: options.generateThumbnails ? undefined : undefined, // TODO: Generate thumbnails
        isSelected: true,
      });
    }

    return Promise.resolve(pages);
  },

  /**
   * Revoke object URL when document is no longer needed.
   *
   * @param document - Document to cleanup
   */
  cleanup: (document: ImportedPdfDocument): void => {
    URL.revokeObjectURL(document.localUri);
  },
};
