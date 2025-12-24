/**
 * Contract API service.
 * Handles contract template loading, PDF generation, and preview.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 */
import { get, post } from '../lib/api-client';

import type {
  ContractTemplate,
  ContractCategory,
  ContractConfig,
  ContractGenerateRequest,
  ContractGenerateResponse,
} from '../types/contract';

/**
 * Response from listing contract templates.
 */
type ListTemplatesResponse = {
  categories: ContractCategory[];
  templates: ContractTemplate[];
  config: ContractConfig;
};

/**
 * Contract API methods.
 */
export const contractApi = {
  /**
   * Load contract templates for an estimate.
   * iOS: loadContracts
   *
   * @param estimateId - The estimate to load templates for
   * @returns Templates grouped by category with config
   */
  listTemplates: async (estimateId: string): Promise<ListTemplatesResponse> => {
    return get<ListTemplatesResponse>(`/contracts/${estimateId}/templates`);
  },

  /**
   * Get contract configuration for preview/send behavior.
   * iOS: uploadConfig
   *
   * @param estimateId - The estimate to get config for
   * @returns Contract configuration settings
   */
  getConfig: async (estimateId: string): Promise<ContractConfig> => {
    return get<ContractConfig>(`/contracts/${estimateId}/config`);
  },

  /**
   * Generate PDF preview from selected templates and form values.
   * iOS: drawContractAndShow / promiseDrawContract
   *
   * @param request - Generation request with templates, values, signatures
   * @returns Generated PDF URL and metadata
   */
  generatePreview: async (
    request: ContractGenerateRequest,
  ): Promise<ContractGenerateResponse> => {
    return post<ContractGenerateResponse>('/contracts/generate', request);
  },

  /**
   * Get the PDF data for a generated contract.
   * Used for downloading or caching the PDF locally.
   *
   * @param pdfUrl - URL of the generated PDF
   * @returns PDF as ArrayBuffer
   */
  downloadPdf: async (pdfUrl: string): Promise<ArrayBuffer> => {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    return response.arrayBuffer();
  },

  /**
   * Refresh the preview page after signature capture.
   * iOS: refreshPage
   *
   * @param pdfUrl - Current PDF URL
   * @param pageNumber - Page number to refresh
   * @returns Updated PDF URL
   */
  refreshPage: async (pdfUrl: string, pageNumber: number): Promise<string> => {
    return post<string>('/contracts/refresh-page', { pdfUrl, pageNumber });
  },
};
