# Middleware

## Purpose

This folder contains Express middleware functions that process requests before they reach route handlers. Middleware handles cross-cutting concerns like authentication, authorization, file uploads, and request validation.

## Structure

| File                   | Purpose                        |
| ---------------------- | ------------------------------ |
| `index.ts`             | Middleware exports             |
| `requireAuth.ts`       | Session-based authentication   |
| `requireOAuth.ts`      | OAuth 2.0 token authentication |
| `requireApiKey.ts`     | API key authentication         |
| `requirePermission.ts` | RBAC permission checking       |
| `upload.ts`            | File upload handling (Multer)  |

## Middleware Reference

### Authentication Middleware

#### `requireAuth()`

Requires an authenticated session. Attaches user to request.

```typescript
import { requireAuth } from '../middleware';

router.get('/protected', requireAuth(), (req, res) => {
  // req.user is available
  res.json({ userId: req.user.id });
});
```

#### `requireMfa()`

Requires MFA verification if user has MFA enabled.

```typescript
router.post('/sensitive-action', requireAuth(), requireMfa(), handler);
```

#### `requireOAuth(scopes?)`

Validates OAuth 2.0 access tokens. Optionally checks required scopes.

```typescript
import { requireOAuth } from '../middleware';

// Require any valid OAuth token
router.get('/api-data', requireOAuth(), handler);

// Require specific scopes
router.get('/user-data', requireOAuth(['user:read']), handler);
```

#### `requireAuthOrOAuth()`

Accepts either session auth or OAuth token.

```typescript
router.get('/flexible', requireAuthOrOAuth(), handler);
```

#### `requireApiKey()`

Validates API key from header or query parameter.

```typescript
import { requireApiKey } from '../middleware';

router.get('/webhook', requireApiKey(), handler);
```

### Authorization Middleware

#### `requirePermission(permission)`

Checks if user has a specific permission.

```typescript
import { requirePermission } from '../middleware';
import { PERMISSIONS } from '../lib/permissions';

router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.USER_DELETE),
  handler,
);
```

#### `requireAllPermissions(permissions[])`

Requires ALL specified permissions (AND logic).

```typescript
import { requireAllPermissions } from '../middleware';

router.post(
  '/admin-action',
  requireAuth(),
  requireAllPermissions([PERMISSIONS.USER_UPDATE, PERMISSIONS.ROLE_ASSIGN]),
  handler,
);
```

#### `requireAnyPermission(permissions[])`

Requires at least ONE permission (OR logic).

```typescript
import { requireAnyPermission } from '../middleware';

router.get(
  '/reports',
  requireAuth(),
  requireAnyPermission([PERMISSIONS.REPORT_READ, PERMISSIONS.ADMIN_ACCESS]),
  handler,
);
```

#### `requireInternalUser()`

Restricts access to internal platform users only.

```typescript
import { requireInternalUser } from '../middleware';

router.get(
  '/platform/companies',
  requireAuth(),
  requireInternalUser(),
  handler,
);
```

#### `requireCompanyContext()`

Ensures internal user has selected an active company.

```typescript
import { requireCompanyContext } from '../middleware';

router.get('/company-data', requireAuth(), requireCompanyContext(), handler);
```

### File Upload Middleware

#### `uploadSingle(fieldName, options?)`

Handles single file upload.

```typescript
import { uploadSingle } from '../middleware';

router.post(
  '/avatar',
  requireAuth(),
  uploadSingle('file', {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png'],
  }),
  handler,
);
```

#### `uploadMultiple(fieldName, maxCount, options?)`

Handles multiple file uploads.

```typescript
import { uploadMultiple } from '../middleware';

router.post(
  '/documents',
  requireAuth(),
  uploadMultiple('files', 10, {
    maxSize: 10 * 1024 * 1024,
  }),
  handler,
);
```

#### `handleUploadError`

Error handler for upload failures.

```typescript
import { handleUploadError } from '../middleware';

router.use(handleUploadError);
```

## Request Type Extensions

### AuthenticatedRequest

```typescript
import type { AuthenticatedRequest } from '../middleware';

router.get('/me', requireAuth(), (req: AuthenticatedRequest, res) => {
  req.user; // User entity
  req.companyId; // Current company ID
  req.session; // Session data
});
```

### OAuthContext

```typescript
import type { OAuthContext } from '../middleware';

router.get('/oauth-data', requireOAuth(), (req: OAuthContext, res) => {
  req.oauth.client; // OAuth client
  req.oauth.user; // Resource owner
  req.oauth.scopes; // Granted scopes
});
```

### ApiKeyContext

```typescript
import type { ApiKeyContext } from '../middleware';

router.get('/webhook', requireApiKey(), (req: ApiKeyContext, res) => {
  req.apiKey.id; // API key ID
  req.apiKey.company; // Associated company
});
```

## Middleware Ordering

Middleware should be applied in this order:

1. **Rate limiting** (applied globally)
2. **Authentication** (`requireAuth`, `requireOAuth`, `requireApiKey`)
3. **Authorization** (`requirePermission`, `requireInternalUser`)
4. **Request processing** (`uploadSingle`, validation)
5. **Route handler**

```typescript
router.post(
  '/resource',
  requireAuth(), // 1. Authentication
  requirePermission(PERMISSIONS.RESOURCE_CREATE), // 2. Authorization
  uploadSingle('file'), // 3. Processing
  async (req, res) => {
    /* handler */
  }, // 4. Handler
);
```

## Error Handling

Middleware throws typed errors that the error handler converts to responses:

| Error                   | HTTP Status | Cause                          |
| ----------------------- | ----------- | ------------------------------ |
| `UnauthorizedError`     | 401         | Missing/invalid authentication |
| `ForbiddenError`        | 403         | Insufficient permissions       |
| `UploadValidationError` | 400         | Invalid file upload            |

## Dependencies

- **express-session** - Session management
- **multer** - File upload handling
- **oauth2-server** - OAuth token validation

## Related

- [Routes](../routes/README.md) - Uses middleware
- [Services](../services/README.md) - PermissionService for auth checks
- [Lib](../lib/README.md) - Permission constants
