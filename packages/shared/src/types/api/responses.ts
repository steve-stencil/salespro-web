/**
 * Common API response wrapper types.
 * These provide consistent response structures across all endpoints.
 */

/** Standard success message response */
export type MessageResponse = {
  message: string;
};

/** Response with a message and additional data */
export type MessageWithDataResponse<T> = {
  message: string;
} & T;
