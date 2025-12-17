# Error Handling Guide

This guide explains the comprehensive error handling system implemented in SalesPro Web, designed to provide user-friendly error messages and help AI agents understand and resolve issues effectively.

## Overview

The error handling system consists of:

- **Backend**: Enhanced error classes with specific error codes and user-friendly messages
- **Frontend**: API client with error handling, React error boundaries, and user-friendly error display
- **Shared**: Common error types and utilities for consistent error handling

## Backend Error Handling

### Error Codes

The system uses comprehensive error codes that help AI agents understand and categorize errors:

```typescript
enum ErrorCode {
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
```

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorEnvelope {
  error: {
    code: string; // Error code for programmatic handling
    message: string; // User-friendly error message
    details?: unknown; // Additional error details
    timestamp: string; // When the error occurred
    path?: string; // API endpoint where error occurred
  };
}
```

### Example Error Responses

#### Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed. Please check your input and try again.",
    "details": {
      "issues": [
        {
          "field": "email",
          "message": "Invalid email format",
          "code": "invalid_string",
          "received": "invalid-email"
        }
      ],
      "summary": "1 validation error found"
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/users"
  }
}
```

#### Authentication Error

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Please log in to continue.",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/protected"
  }
}
```

#### Resource Not Found

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User with ID '123' not found",
    "details": {
      "resource": "User",
      "id": "123"
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/users/123"
  }
}
```

## Frontend Error Handling

### API Client

The enhanced API client provides comprehensive error handling:

```typescript
import { apiClient, ApiClientError } from '../lib/api-client';

try {
  const user = await apiClient.get<User>('/users/123');
} catch (error) {
  if (error instanceof ApiClientError) {
    console.log('Error code:', error.apiError.code);
    console.log('User message:', error.message);
    console.log('Is retryable:', isRetryableApiError(error));
  }
}
```

### React Error Handling Hook

Use the `useApiError` hook for handling API errors in React components:

```typescript
import { useApiError } from '../hooks/useApiError';

function UserProfile() {
  const { error, handleError, clearError, isAuthenticationError } = useApiError();

  const handleSubmit = async (data: UserData) => {
    try {
      await apiClient.post('/users', data);
      clearError();
    } catch (error) {
      handleError(error);
    }
  };

  if (isAuthenticationError()) {
    return <LoginPrompt />;
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      {/* form fields */}
    </form>
  );
}
```

### Error Boundary

Wrap your app or components with the error boundary:

```typescript
import { ErrorBoundary } from '../components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      fallback={<CustomErrorFallback />}
      onError={(error, errorInfo) => {
        // Log error to monitoring service
        console.error('Error caught by boundary:', error, errorInfo);
      }}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

## AI Agent Error Handling

### Understanding Error Codes

AI agents can use error codes to understand and respond to errors:

```typescript
// Check if error is authentication-related
if (
  error.code === ErrorCode.UNAUTHORIZED ||
  error.code === ErrorCode.TOKEN_EXPIRED
) {
  // Redirect to login or refresh token
}

// Check if error is validation-related
if (error.code === ErrorCode.VALIDATION_ERROR) {
  // Show validation errors to user
  // Help user fix input issues
}

// Check if error is retryable
if (isRetryableError(error)) {
  // Implement retry logic
  // Show retry button to user
}
```

### Common Error Scenarios

#### 1. Validation Errors

**AI Agent Response**: "I see there are validation errors. Let me help you fix them:"

- Show specific field errors
- Provide examples of correct input
- Guide user through fixing the form

#### 2. Authentication Errors

**AI Agent Response**: "You need to log in to access this feature. Let me help you:"

- Redirect to login page
- Explain authentication requirements
- Help with login process

#### 3. Resource Not Found

**AI Agent Response**: "The item you're looking for doesn't exist. Let me help you:"

- Check if ID is correct
- Suggest similar items
- Help navigate to correct resource

#### 4. Server Errors

**AI Agent Response**: "There's a server issue. Let me try to resolve it:"

- Implement retry logic
- Check server status
- Provide alternative solutions

## Error Handling Best Practices

### For Developers

1. **Always handle errors gracefully**:

   ```typescript
   try {
     const result = await apiCall();
   } catch (error) {
     // Handle error appropriately
     handleError(error);
   }
   ```

2. **Use specific error types**:

   ```typescript
   if (error instanceof ApiClientError) {
     // Handle API errors
   } else if (error instanceof ValidationError) {
     // Handle validation errors
   }
   ```

3. **Provide user-friendly messages**:
   ```typescript
   const message = getErrorMessage(error);
   showToast(message);
   ```

### For AI Agents

1. **Analyze error codes** to understand the issue
2. **Provide specific solutions** based on error type
3. **Guide users through error resolution**
4. **Implement retry logic** for retryable errors
5. **Escalate to human support** for complex issues

## Error Monitoring and Logging

### Backend Logging

```typescript
// Log errors with context
console.error('API Error:', {
  code: error.code,
  message: error.message,
  path: req.path,
  userId: req.user?.id,
  timestamp: new Date().toISOString(),
});
```

### Frontend Logging

```typescript
// Log errors for debugging
console.error('Frontend Error:', {
  error: error.message,
  stack: error.stack,
  component: 'UserProfile',
  timestamp: new Date().toISOString(),
});
```

## Testing Error Handling

### Unit Tests

```typescript
describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const error = AppError.validationError('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
  });

  it('should handle authentication errors', async () => {
    const error = AppError.unauthorized();
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.status).toBe(401);
  });
});
```

### Integration Tests

```typescript
describe('API Error Handling', () => {
  it('should return validation error for invalid input', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Troubleshooting Common Issues

### 1. "Network Error" Messages

- Check internet connection
- Verify API endpoint is accessible
- Check CORS configuration

### 2. "Validation Error" Messages

- Check input format
- Verify required fields
- Check data types

### 3. "Authentication Error" Messages

- Check if user is logged in
- Verify token is valid
- Check session expiration

### 4. "Server Error" Messages

- Check server logs
- Verify database connection
- Check external service status

This comprehensive error handling system ensures that both users and AI agents can effectively understand, communicate, and resolve errors in the application.
