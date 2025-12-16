import { ZodError } from 'zod';

import type { ErrorRequestHandler, Request, Response } from 'express';

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    path?: string | undefined;
  };
};

// Comprehensive error codes for better AI agent understanding
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

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: string;
  public readonly path?: string | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    path?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.path = path ?? undefined;
  }

  // Validation errors
  static validationError(message: string, details?: unknown, path?: string) {
    return new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      message,
      details,
      path,
    );
  }

  static invalidInput(
    field: string,
    value: unknown,
    expected: string,
    path?: string,
  ) {
    return new AppError(
      400,
      ErrorCode.INVALID_INPUT,
      `Invalid ${field}: expected ${expected}, got ${typeof value}`,
      { field, value, expected },
      path,
    );
  }

  static missingRequiredField(field: string, path?: string) {
    return new AppError(
      400,
      ErrorCode.MISSING_REQUIRED_FIELD,
      `Missing required field: ${field}`,
      { field },
      path,
    );
  }

  // Authentication errors
  static unauthorized(message = 'Authentication required', path?: string) {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message, undefined, path);
  }

  static forbidden(message = 'Access denied', path?: string) {
    return new AppError(403, ErrorCode.FORBIDDEN, message, undefined, path);
  }

  static tokenExpired(path?: string) {
    return new AppError(
      401,
      ErrorCode.TOKEN_EXPIRED,
      'Your session has expired. Please log in again.',
      undefined,
      path,
    );
  }

  static invalidCredentials(path?: string) {
    return new AppError(
      401,
      ErrorCode.INVALID_CREDENTIALS,
      'Invalid email or password. Please check your credentials and try again.',
      undefined,
      path,
    );
  }

  // Resource errors
  static notFound(resource?: string, id?: string, path?: string) {
    let message: string;
    if (resource) {
      if (id) {
        message = `${resource} with ID '${id}' not found`;
      } else {
        message = `${resource} not found`;
      }
    } else {
      message = 'Not found';
    }
    return new AppError(
      404,
      ErrorCode.NOT_FOUND,
      message,
      { resource, id },
      path,
    );
  }

  static resourceConflict(
    resource: string,
    field: string,
    value: string,
    path?: string,
  ) {
    return new AppError(
      409,
      ErrorCode.RESOURCE_CONFLICT,
      `${resource} with ${field} '${value}' already exists`,
      { resource, field, value },
      path,
    );
  }

  static resourceLocked(resource: string, reason: string, path?: string) {
    return new AppError(
      423,
      ErrorCode.RESOURCE_LOCKED,
      `${resource} is currently locked: ${reason}`,
      { resource, reason },
      path,
    );
  }

  // Database errors
  static databaseError(operation: string, details?: unknown, path?: string) {
    return new AppError(
      500,
      ErrorCode.DATABASE_ERROR,
      `Database error during ${operation}`,
      { operation, details },
      path,
    );
  }

  static connectionError(service: string, path?: string) {
    return new AppError(
      503,
      ErrorCode.CONNECTION_ERROR,
      `Unable to connect to ${service}. Please try again later.`,
      { service },
      path,
    );
  }

  static queryError(query: string, details?: unknown, path?: string) {
    return new AppError(
      500,
      ErrorCode.QUERY_ERROR,
      `Query failed: ${query}`,
      { query, details },
      path,
    );
  }

  // Business logic errors
  static businessRuleViolation(rule: string, details?: unknown, path?: string) {
    return new AppError(
      422,
      ErrorCode.BUSINESS_RULE_VIOLATION,
      `Business rule violation: ${rule}`,
      { rule, details },
      path,
    );
  }

  static operationNotAllowed(operation: string, reason: string, path?: string) {
    return new AppError(
      403,
      ErrorCode.OPERATION_NOT_ALLOWED,
      `Operation '${operation}' not allowed: ${reason}`,
      { operation, reason },
      path,
    );
  }

  static rateLimitExceeded(limit: number, window: string, path?: string) {
    return new AppError(
      429,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Maximum ${limit} requests per ${window}`,
      { limit, window },
      path,
    );
  }

  // System errors
  static internal(
    message = 'An unexpected error occurred',
    details?: unknown,
    path?: string,
  ) {
    return new AppError(500, ErrorCode.INTERNAL_ERROR, message, details, path);
  }

  static serviceUnavailable(service: string, path?: string) {
    return new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} is temporarily unavailable. Please try again later.`,
      { service },
      path,
    );
  }

  static timeout(operation: string, timeoutMs: number, path?: string) {
    return new AppError(
      504,
      ErrorCode.TIMEOUT,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      { operation, timeoutMs },
      path,
    );
  }

  // Client errors
  static badRequest(message: string, details?: unknown, path?: string) {
    return new AppError(400, ErrorCode.BAD_REQUEST, message, details, path);
  }

  static methodNotAllowed(
    method: string,
    allowedMethods: string[],
    path?: string,
  ) {
    return new AppError(
      405,
      ErrorCode.METHOD_NOT_ALLOWED,
      `Method '${method}' not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      { method, allowedMethods },
      path,
    );
  }

  static unsupportedMediaType(
    contentType: string,
    allowedTypes: string[],
    path?: string,
  ) {
    return new AppError(
      415,
      ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      `Content type '${contentType}' not supported. Allowed types: ${allowedTypes.join(', ')}`,
      { contentType, allowedTypes },
      path,
    );
  }
}

export function formatZod(err: ZodError, path?: string): ErrorEnvelope {
  const issues = err.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
    received: 'received' in issue ? issue.received : undefined,
  }));

  return {
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed. Please check your input and try again.',
      details: {
        issues,
        summary: `${issues.length} validation error${issues.length === 1 ? '' : 's'} found`,
      },
      timestamp: new Date().toISOString(),
      path: path ?? undefined,
    },
  };
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
) => {
  const path = req.path;

  if (err instanceof AppError) {
    const body: ErrorEnvelope = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp: err.timestamp,
        path: err.path ?? path,
      },
    };
    return res.status(err.status).json(body);
  }

  if (err instanceof ZodError) {
    const body = formatZod(err, path);
    return res.status(400).json(body);
  }

  // Log unexpected errors for debugging
  console.error('Unexpected error:', err);

  const body: ErrorEnvelope = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
      timestamp: new Date().toISOString(),
      path,
    },
  };
  return res.status(500).json(body);
};
