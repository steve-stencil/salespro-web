/**
 * API client for mobile app.
 * Pre-configured axios instance with interceptors for authentication,
 * error handling, and response transformation.
 */
import axios from 'axios';

import type { ApiError } from '../types/api';
import type { AxiosError, AxiosResponse } from 'axios';

/**
 * Base URL for API requests.
 * Uses environment variable with fallback to relative path.
 */
const API_BASE_URL = import.meta.env['VITE_API_BASE'] || '/api';

/**
 * Configured axios instance for all API calls.
 * Includes credentials for cookie-based auth and response interceptors.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Response interceptor to unwrap successful responses
 * and format errors consistently.
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error: AxiosError<ApiError>) => {
    const response = error.response;
    const data = response?.data;
    const apiError: ApiError = {
      message: data?.message ?? error.message,
      statusCode: response?.status ?? 500,
      errors: data?.errors,
    };
    return Promise.reject(new Error(apiError.message));
  },
);

/**
 * Helper function for GET requests with typed response.
 */
export async function get<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return apiClient.get<never, T>(url, { params });
}

/**
 * Helper function for POST requests with typed response.
 */
export async function post<T>(url: string, data?: unknown): Promise<T> {
  return apiClient.post<never, T>(url, data);
}

/**
 * Helper function for PATCH requests with typed response.
 */
export async function patch<T>(url: string, data?: unknown): Promise<T> {
  return apiClient.patch<never, T>(url, data);
}

/**
 * Helper function for DELETE requests.
 */
export async function del(url: string): Promise<void> {
  return apiClient.delete(url);
}

/**
 * Helper function for file uploads with multipart/form-data.
 */
export async function uploadFile<T>(
  url: string,
  file: File,
  fieldName = 'file',
): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);
  return apiClient.post<never, T>(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
