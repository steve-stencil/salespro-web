/**
 * Pagination types for API responses.
 * Used across all paginated list endpoints.
 */

/** Standard pagination metadata */
export type Pagination = {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
};

/** Common query parameters for paginated list endpoints */
export type PaginationParams = {
  /** Page number to retrieve (1-indexed) */
  page?: number;
  /** Number of items per page (default varies by endpoint) */
  limit?: number;
};

/** Generic paginated response wrapper */
export type PaginatedResponse<T> = {
  /** Array of items for this page */
  items: T[];
  /** Pagination metadata */
  pagination: Pagination;
};
