/**
 * Common API types for mobile app.
 */

/**
 * Standard API error response structure.
 */
export type ApiError = {
  message: string;
  statusCode: number;
  errors?: ValidationError[];
};

/**
 * Field-level validation error.
 */
export type ValidationError = {
  field: string;
  message: string;
};

/**
 * Paginated list response structure.
 */
export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};
