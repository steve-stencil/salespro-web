/**
 * Parse Client for ETL Operations
 *
 * Client for communicating with the legacy Parse server
 * to fetch document templates, offices, and types.
 */

import { env } from '../../config/env';

import { EtlErrorCode, EtlServiceError } from './types';

import type { ParseSourceOffice, RawDocumentObject } from './types';

/**
 * Parse query response structure.
 */
type ParseQueryResponse<T> = {
  results: T[];
};

/**
 * Parse query options for pagination.
 */
type ParseQueryOptions = {
  skip?: number;
  limit?: number;
  order?: string;
  where?: Record<string, unknown>;
  keys?: string[];
};

/**
 * Create HTTP headers for Parse API requests.
 */
function createParseHeaders(): Record<string, string> {
  const appId = env.PARSE_APP_ID;
  const masterKey = env.PARSE_MASTER_KEY;

  if (!appId || !masterKey) {
    throw new EtlServiceError(
      'Parse credentials not configured. Set PARSE_APP_ID and PARSE_MASTER_KEY.',
      EtlErrorCode.PARSE_CONNECTION_FAILED,
    );
  }

  return {
    'X-Parse-Application-Id': appId,
    'X-Parse-Master-Key': masterKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Build Parse query URL with parameters.
 */
function buildQueryUrl(
  className: string,
  options: ParseQueryOptions = {},
): string {
  const serverUrl = env.PARSE_SERVER_URL;
  if (!serverUrl) {
    throw new EtlServiceError(
      'Parse server URL not configured. Set PARSE_SERVER_URL.',
      EtlErrorCode.PARSE_CONNECTION_FAILED,
    );
  }

  const url = new URL(`${serverUrl}/classes/${className}`);

  if (options.skip !== undefined) {
    url.searchParams.set('skip', String(options.skip));
  }
  if (options.limit !== undefined) {
    url.searchParams.set('limit', String(options.limit));
  }
  if (options.order) {
    url.searchParams.set('order', options.order);
  }
  if (options.where) {
    url.searchParams.set('where', JSON.stringify(options.where));
  }
  if (options.keys) {
    url.searchParams.set('keys', options.keys.join(','));
  }

  // Always request count for pagination
  url.searchParams.set('count', '1');

  return url.toString();
}

/**
 * Parse API client for ETL operations.
 */
export class ParseClient {
  /**
   * Query offices from Parse.
   */
  async queryOffices(): Promise<ParseSourceOffice[]> {
    const url = buildQueryUrl('Office', {
      keys: ['objectId', 'name'],
      limit: 1000,
      order: 'name',
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: createParseHeaders(),
    });

    if (!response.ok) {
      throw new EtlServiceError(
        `Failed to fetch offices from Parse: ${response.statusText}`,
        EtlErrorCode.PARSE_QUERY_FAILED,
      );
    }

    const data = (await response.json()) as ParseQueryResponse<{
      objectId: string;
      name?: string;
    }>;
    return data.results.map(o => ({
      objectId: o.objectId,
      name: o.name ?? 'Unknown',
    }));
  }

  /**
   * Query distinct document types from Parse.
   * Returns unique type values from ContractObject class.
   */
  async queryDocumentTypes(): Promise<string[]> {
    const url = buildQueryUrl('ContractObject', {
      keys: ['type'],
      limit: 1000,
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: createParseHeaders(),
    });

    if (!response.ok) {
      throw new EtlServiceError(
        `Failed to fetch document types from Parse: ${response.statusText}`,
        EtlErrorCode.PARSE_QUERY_FAILED,
      );
    }

    const data = (await response.json()) as ParseQueryResponse<{
      type: string;
    }>;

    // Extract unique types
    const types = new Set<string>();
    for (const doc of data.results) {
      if (doc.type) {
        types.add(doc.type);
      }
    }

    return Array.from(types).sort();
  }

  /**
   * Count total documents in Parse.
   */
  async countDocuments(): Promise<number> {
    const url = buildQueryUrl('ContractObject', {
      limit: 0,
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: createParseHeaders(),
    });

    if (!response.ok) {
      throw new EtlServiceError(
        `Failed to count documents from Parse: ${response.statusText}`,
        EtlErrorCode.PARSE_QUERY_FAILED,
      );
    }

    const data = (await response.json()) as { count?: number };
    return data.count ?? 0;
  }

  /**
   * Query documents from Parse with pagination.
   */
  async queryDocuments(
    skip: number,
    limit: number,
  ): Promise<RawDocumentObject[]> {
    const url = buildQueryUrl('ContractObject', {
      skip,
      limit,
      order: 'createdAt',
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: createParseHeaders(),
    });

    if (!response.ok) {
      throw new EtlServiceError(
        `Failed to fetch documents from Parse: ${response.statusText}`,
        EtlErrorCode.PARSE_QUERY_FAILED,
      );
    }

    const data =
      (await response.json()) as ParseQueryResponse<RawDocumentObject>;
    return data.results;
  }

  /**
   * Download a file from Parse URL.
   */
  async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new EtlServiceError(
        `Failed to download file: ${response.statusText}`,
        EtlErrorCode.FILE_DOWNLOAD_FAILED,
        { url },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

/**
 * Create a Parse client instance.
 */
export function createParseClient(): ParseClient {
  return new ParseClient();
}
