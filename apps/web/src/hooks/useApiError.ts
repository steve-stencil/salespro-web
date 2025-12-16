// React hook for handling API errors with user-friendly messages
import { ErrorCode } from '@shared/types/errors';
import { useState, useCallback } from 'react';

import {
  ApiClientError,
  handleApiError,
  isRetryableApiError,
} from '../lib/api-client';

type ApiErrorState = {
  error: string | null;
  code: string | null;
  isRetryable: boolean;
  timestamp: string | null;
};

export function useApiError() {
  const [errorState, setErrorState] = useState<ApiErrorState>({
    error: null,
    code: null,
    isRetryable: false,
    timestamp: null,
  });

  const handleError = useCallback((error: unknown) => {
    const errorMessage = handleApiError(error);
    const isRetryable = isRetryableApiError(error);

    let errorCode: string | null = null;
    if (error instanceof ApiClientError) {
      errorCode = error.apiError.code;
    }

    setErrorState({
      error: errorMessage,
      code: errorCode,
      isRetryable,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      code: null,
      isRetryable: false,
      timestamp: null,
    });
  }, []);

  const isSpecificError = useCallback(
    (code: ErrorCode) => {
      return errorState.code === code;
    },
    [errorState.code],
  );

  const isAuthenticationError = useCallback(() => {
    return (
      isSpecificError(ErrorCode.UNAUTHORIZED) ||
      isSpecificError(ErrorCode.TOKEN_EXPIRED) ||
      isSpecificError(ErrorCode.INVALID_CREDENTIALS)
    );
  }, [isSpecificError]);

  const isValidationError = useCallback(() => {
    return (
      isSpecificError(ErrorCode.VALIDATION_ERROR) ||
      isSpecificError(ErrorCode.INVALID_INPUT) ||
      isSpecificError(ErrorCode.MISSING_REQUIRED_FIELD)
    );
  }, [isSpecificError]);

  const isServerError = useCallback(() => {
    return (
      isSpecificError(ErrorCode.INTERNAL_ERROR) ||
      isSpecificError(ErrorCode.DATABASE_ERROR) ||
      isSpecificError(ErrorCode.CONNECTION_ERROR) ||
      isSpecificError(ErrorCode.SERVICE_UNAVAILABLE)
    );
  }, [isSpecificError]);

  return {
    ...errorState,
    handleError,
    clearError,
    isSpecificError,
    isAuthenticationError,
    isValidationError,
    isServerError,
  };
}
