/**
 * Import hook for PDF import from device.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 * documentPicker:didPickDocumentsAtURLs:
 */
import { useState, useCallback } from 'react';

import { useFeatureFlags } from '../context/FeatureFlagContext';
import { importService } from '../services/import';

import type {
  ImportedPdfDocument,
  ImportPdfResult,
  MultiImportResult,
  PageExtractionOptions,
  ExtractedPage,
} from '../types/import';

/**
 * Hook for managing imported PDF documents.
 *
 * @returns Import state and handlers
 */
export function useImportedDocuments() {
  const { flags } = useFeatureFlags();
  const [documents, setDocuments] = useState<ImportedPdfDocument[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  /**
   * Import a single PDF.
   * iOS: documentPicker:didPickDocumentsAtURLs:
   */
  const importPdf = useCallback(
    async (file: File): Promise<ImportPdfResult> => {
      if (!flags.pdfImportEnabled) {
        return { success: false, errorMessage: 'PDF import is disabled' };
      }

      setIsImporting(true);
      setImportError(null);

      try {
        const result = await importService.importPdf(file);
        if (result.success && result.document) {
          setDocuments(prev => [...prev, result.document!]);
        } else {
          setImportError(result.errorMessage ?? 'Import failed');
        }
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Import failed';
        setImportError(message);
        return { success: false, errorMessage: message };
      } finally {
        setIsImporting(false);
      }
    },
    [flags.pdfImportEnabled],
  );

  /**
   * Import multiple PDFs.
   */
  const importMultiple = useCallback(
    async (files: File[]): Promise<MultiImportResult> => {
      if (!flags.pdfImportEnabled) {
        return {
          successCount: 0,
          failureCount: files.length,
          documents: [],
          errors: [],
        };
      }

      setIsImporting(true);
      setImportError(null);

      try {
        const result = await importService.importMultiplePdfs(files);
        if (result.successCount > 0) {
          setDocuments(prev => [...prev, ...result.documents]);
        }
        if (result.failureCount > 0) {
          setImportError(`Failed to import ${result.failureCount} file(s)`);
        }
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Import failed';
        setImportError(message);
        return {
          successCount: 0,
          failureCount: files.length,
          documents: [],
          errors: [],
        };
      } finally {
        setIsImporting(false);
      }
    },
    [flags.pdfImportEnabled],
  );

  /**
   * Toggle document selection.
   */
  const toggleSelection = useCallback((documentId: string): void => {
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === documentId ? { ...doc, isSelected: !doc.isSelected } : doc,
      ),
    );
  }, []);

  /**
   * Remove a document.
   */
  const removeDocument = useCallback((documentId: string): void => {
    setDocuments(prev => {
      const doc = prev.find(d => d.id === documentId);
      if (doc) {
        importService.cleanup(doc);
      }
      return prev.filter(d => d.id !== documentId);
    });
  }, []);

  /**
   * Clear all documents.
   */
  const clearAll = useCallback((): void => {
    documents.forEach(doc => importService.cleanup(doc));
    setDocuments([]);
  }, [documents]);

  /**
   * Get selected documents.
   */
  const selectedDocuments = documents.filter(d => d.isSelected);

  /**
   * Clear import error.
   */
  const clearError = useCallback((): void => {
    setImportError(null);
  }, []);

  return {
    documents,
    selectedDocuments,
    isImporting,
    importError,
    isEnabled: flags.pdfImportEnabled,
    importPdf,
    importMultiple,
    toggleSelection,
    removeDocument,
    clearAll,
    clearError,
  };
}

/**
 * Hook for page extraction from imported PDFs.
 *
 * @param document - Imported document
 * @returns Page extraction handlers
 */
export function usePageExtraction(document: ImportedPdfDocument | null) {
  const [pages, setPages] = useState<ExtractedPage[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  /**
   * Extract pages from document.
   */
  const extractPages = useCallback(
    async (
      options: PageExtractionOptions = { generateThumbnails: true },
    ): Promise<void> => {
      if (!document) return;

      setIsExtracting(true);
      try {
        const extractedPages = await importService.extractPages(
          document,
          options,
        );
        setPages(extractedPages);
      } finally {
        setIsExtracting(false);
      }
    },
    [document],
  );

  /**
   * Toggle page selection.
   */
  const togglePage = useCallback((pageNumber: number): void => {
    setPages(prev =>
      prev.map(page =>
        page.pageNumber === pageNumber
          ? { ...page, isSelected: !page.isSelected }
          : page,
      ),
    );
  }, []);

  /**
   * Select all pages.
   */
  const selectAll = useCallback((): void => {
    setPages(prev => prev.map(page => ({ ...page, isSelected: true })));
  }, []);

  /**
   * Deselect all pages.
   */
  const deselectAll = useCallback((): void => {
    setPages(prev => prev.map(page => ({ ...page, isSelected: false })));
  }, []);

  return {
    pages,
    isExtracting,
    extractPages,
    togglePage,
    selectAll,
    deselectAll,
    selectedPages: pages.filter(p => p.isSelected),
  };
}
