/**
 * Enhanced API client using axios with comprehensive error handling.
 * Uses session-based authentication with HTTP-only cookies.
 */
import {
  getErrorMessage,
  isRetryableError,
  ErrorCode,
} from '@shared/types/errors';
import axios from 'axios';

import type { ApiError } from '@shared/types/errors';
import type { AxiosError, AxiosResponse } from 'axios';

const API_BASE =
  import.meta.env['VITE_API_BASE'] ?? 'http://localhost:4000/api';

/**
 * Custom error class for API errors with structured error data.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly apiError: ApiError,
    public readonly status: number,
    public readonly response?: AxiosResponse,
  ) {
    super(getErrorMessage(apiError));
    this.name = 'ApiClientError';
  }
}

/**
 * Axios instance configured for the API.
 * - withCredentials: true for session cookie handling
 * - JSON content type by default
 */
const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for session cookies
});

/**
 * Response interceptor to transform errors into ApiClientError.
 */
axiosInstance.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    const errorPath = error.config?.url;

    if (error.response) {
      const errorData = error.response.data as Record<string, unknown> | null;

      // Check for structured API error response
      if (errorData !== null && 'error' in errorData) {
        const apiError = errorData['error'] as ApiError;
        throw new ApiClientError(
          apiError,
          error.response.status,
          error.response,
        );
      }

      // Handle auth-specific error responses (different structure)
      if (errorData !== null && 'errorCode' in errorData) {
        const authError: ApiError = {
          code: ErrorCode.UNAUTHORIZED,
          message: (errorData['error'] as string) || 'Authentication failed',
          timestamp: new Date().toISOString(),
          details: errorData,
        };
        if (errorPath) {
          authError.path = errorPath;
        }
        throw new ApiClientError(
          authError,
          error.response.status,
          error.response,
        );
      }

      // Fallback for non-JSON or unexpected error responses
      const fallbackError: ApiError = {
        code: ErrorCode.INTERNAL_ERROR,
        message: `HTTP ${error.response.status}: ${error.response.statusText}`,
        timestamp: new Date().toISOString(),
      };
      if (errorPath) {
        fallbackError.path = errorPath;
      }
      throw new ApiClientError(
        fallbackError,
        error.response.status,
        error.response,
      );
    }

    // Network or other errors (no response)
    const networkError: ApiError = {
      code: ErrorCode.CONNECTION_ERROR,
      message: 'Network error. Please check your internet connection.',
      timestamp: new Date().toISOString(),
    };
    if (errorPath) {
      networkError.path = errorPath;
    }
    throw new ApiClientError(networkError, 0);
  },
);

/**
 * API client class providing typed HTTP methods.
 */
export class ApiClient {
  /**
   * Performs a GET request.
   */
  async get<T>(endpoint: string): Promise<T> {
    const response = await axiosInstance.get<T>(endpoint);
    return response.data;
  }

  /**
   * Performs a POST request with optional body data.
   */
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await axiosInstance.post<T>(endpoint, data);
    return response.data;
  }

  /**
   * Performs a PUT request with optional body data.
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await axiosInstance.put<T>(endpoint, data);
    return response.data;
  }

  /**
   * Performs a PATCH request with optional body data.
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await axiosInstance.patch<T>(endpoint, data);
    return response.data;
  }

  /**
   * Performs a DELETE request.
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await axiosInstance.delete<T>(endpoint);
    return response.data;
  }

  /**
   * Health check endpoint.
   */
  async healthCheck(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/healthz');
  }

  /**
   * Readiness check endpoint.
   */
  async readinessCheck(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/readyz');
  }
}

/**
 * Helper function to extract user-friendly error message from any error.
 */
export function handleApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Helper function to check if an error is retryable.
 */
export function isRetryableApiError(error: unknown): boolean {
  if (error instanceof ApiClientError) {
    return isRetryableError(error.apiError);
  }

  return false;
}

/**
 * Retry mechanism with exponential backoff for retryable errors.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableApiError(error) || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

/** Singleton API client instance */
export const apiClient = new ApiClient();

/** Export the axios instance for direct use if needed */
export { axiosInstance };
