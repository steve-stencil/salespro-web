// Shared error types for consistent error handling across the application

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
  timestamp: string;
  path?: string;
};

export type ErrorResponse = {
  error: ApiError;
};

// Error codes that match the backend ErrorCode enum
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',

  // Business logic errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',

  // Client errors
  BAD_REQUEST = 'BAD_REQUEST',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
}

// User-friendly error messages for common error codes
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'The information you entered is not valid.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields.',
  [ErrorCode.UNAUTHORIZED]: 'Please log in to continue.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.INVALID_CREDENTIALS]:
    'Invalid email or password. Please check your credentials.',
  [ErrorCode.NOT_FOUND]: 'The requested item was not found.',
  [ErrorCode.RESOURCE_CONFLICT]: 'This item already exists.',
  [ErrorCode.RESOURCE_LOCKED]: 'This item is currently unavailable.',
  [ErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again.',
  [ErrorCode.CONNECTION_ERROR]:
    'Unable to connect to the server. Please check your internet connection.',
  [ErrorCode.QUERY_ERROR]: 'A database query failed. Please try again.',
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 'This action violates a business rule.',
  [ErrorCode.OPERATION_NOT_ALLOWED]: 'This operation is not allowed.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]:
    'Too many requests. Please wait a moment and try again.',
  [ErrorCode.INTERNAL_ERROR]:
    'An unexpected error occurred. Please try again later.',
  [ErrorCode.SERVICE_UNAVAILABLE]:
    'The service is temporarily unavailable. Please try again later.',
  [ErrorCode.TIMEOUT]: 'The request timed out. Please try again.',
  [ErrorCode.BAD_REQUEST]: 'Invalid request. Please check your input.',
  [ErrorCode.METHOD_NOT_ALLOWED]: 'This action is not allowed.',
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: 'The file type is not supported.',
};

// Helper function to get user-friendly error message
export function getErrorMessage(error: ApiError): string {
  // Use the specific error message if available, otherwise use the generic one
  return error.message || ERROR_MESSAGES[error.code] || 'An error occurred.';
}

// Helper function to check if an error is a specific type
export function isErrorCode(error: ApiError, code: ErrorCode): boolean {
  return error.code === code;
}

// Helper function to check if an error is a client error (4xx)
export function isClientError(error: ApiError): boolean {
  const clientErrorCodes = [
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.INVALID_INPUT,
    ErrorCode.MISSING_REQUIRED_FIELD,
    ErrorCode.UNAUTHORIZED,
    ErrorCode.FORBIDDEN,
    ErrorCode.TOKEN_EXPIRED,
    ErrorCode.INVALID_CREDENTIALS,
    ErrorCode.NOT_FOUND,
    ErrorCode.RESOURCE_CONFLICT,
    ErrorCode.RESOURCE_LOCKED,
    ErrorCode.BUSINESS_RULE_VIOLATION,
    ErrorCode.OPERATION_NOT_ALLOWED,
    ErrorCode.RATE_LIMIT_EXCEEDED,
    ErrorCode.BAD_REQUEST,
    ErrorCode.METHOD_NOT_ALLOWED,
    ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  ];
  return clientErrorCodes.includes(error.code);
}

// Helper function to check if an error is a server error (5xx)
export function isServerError(error: ApiError): boolean {
  const serverErrorCodes = [
    ErrorCode.DATABASE_ERROR,
    ErrorCode.CONNECTION_ERROR,
    ErrorCode.QUERY_ERROR,
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.TIMEOUT,
  ];
  return serverErrorCodes.includes(error.code);
}

// Helper function to check if an error is retryable
export function isRetryableError(error: ApiError): boolean {
  const retryableCodes = [
    ErrorCode.CONNECTION_ERROR,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.TIMEOUT,
    ErrorCode.RATE_LIMIT_EXCEEDED,
  ];
  return retryableCodes.includes(error.code);
}
