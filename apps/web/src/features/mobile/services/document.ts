/**
 * Document API service.
 * Handles document template loading and management.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m loadContracts
 */
import { get } from '../lib/api-client';

import type {
  DocumentTemplate,
  DocumentCategory,
  DocumentTemplatesResponse,
} from '../types/document';

/**
 * Parameters for listing templates.
 */
export type ListTemplatesParams = {
  /** Filter by template type (e.g., 'contract', 'proposal') */
  type?: string;
  /** Filter by customer state (2-letter code) */
  state?: string;
  /** Filter by office ID */
  officeId?: string;
  /** Sort mode: 'order' (default) or 'alphabetic' */
  sort?: 'order' | 'alphabetic';
};

/**
 * API response type for template list.
 */
type ApiTemplateListResponse = {
  templates: DocumentTemplate[];
  categories: DocumentCategory[];
};

/**
 * API response type for template detail.
 */
type ApiTemplateDetailResponse = {
  template: DocumentTemplate & {
    contractDataJson: unknown;
    imagesJson?: unknown;
    pdfUrl?: string;
    watermarkUrl?: string;
    hasUserInput: boolean;
    signatureFieldCount: number;
    initialsFieldCount: number;
  };
};

/**
 * Document API methods.
 */
export const documentApi = {
  /**
   * Load document templates for the current company.
   * iOS: loadContracts, sortContracts
   *
   * @param params - Filter and sort parameters
   * @returns Templates and categories
   */
  listTemplates: async (
    params?: ListTemplatesParams,
  ): Promise<DocumentTemplatesResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.state) searchParams.set('state', params.state);
    if (params?.officeId) searchParams.set('officeId', params.officeId);
    if (params?.sort) searchParams.set('sort', params.sort);

    const query = searchParams.toString();
    const url = query ? `/mobile/templates?${query}` : '/mobile/templates';
    const response = await get<ApiTemplateListResponse>(url);

    return {
      templates: response.templates,
      categories: response.categories,
    };
  },

  /**
   * Get full template detail including contractDataJson.
   * iOS: Full template data for form rendering
   *
   * @param templateId - The template ID
   * @returns Full template detail
   */
  getTemplateDetail: async (
    templateId: string,
  ): Promise<ApiTemplateDetailResponse['template']> => {
    const response = await get<ApiTemplateDetailResponse>(
      `/mobile/templates/${templateId}`,
    );
    return response.template;
  },

  /**
   * Get template thumbnail URL.
   * iOS: thumbnailImage, iconImage in ContractObject
   *
   * @param templateId - The template ID
   * @returns Thumbnail URL
   */
  getThumbnailUrl: (templateId: string): string => {
    return `/api/mobile/templates/${templateId}/thumbnail`;
  },
};
