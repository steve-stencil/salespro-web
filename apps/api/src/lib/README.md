# Library Utilities

## Purpose

This folder contains shared utility libraries, helpers, and core infrastructure code used throughout the API. These are low-level building blocks that services and routes depend on.

## Structure

### Root Files

| File                 | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `crypto.ts`          | Cryptographic utilities (hashing, token generation, TOTP) |
| `db.ts`              | Database connection and MikroORM initialization           |
| `email.ts`           | Email sending service (AWS SES integration)               |
| `email-templates.ts` | HTML email templates for various notifications            |
| `errors.ts`          | Custom error classes and error handling utilities         |
| `permissions.ts`     | RBAC permission constants and metadata                    |

### Subfolders

#### `oauth/`

OAuth 2.0 implementation utilities:

| File        | Purpose                                      |
| ----------- | -------------------------------------------- |
| `index.ts`  | OAuth server setup and exports               |
| `model.ts`  | OAuth2Server model implementation            |
| `pkce.ts`   | PKCE (Proof Key for Code Exchange) utilities |
| `scopes.ts` | OAuth scope definitions and validation       |

#### `session/`

Session management utilities:

| File               | Purpose                             |
| ------------------ | ----------------------------------- |
| `index.ts`         | Session configuration and exports   |
| `middleware.ts`    | Express session middleware setup    |
| `MikroOrmStore.ts` | Custom session store using MikroORM |

#### `storage/`

File storage abstraction layer:

| File                     | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `index.ts`               | Storage adapter factory and exports       |
| `types.ts`               | Storage interface definitions             |
| `LocalStorageAdapter.ts` | Local filesystem storage (development)    |
| `S3StorageAdapter.ts`    | AWS S3 storage (production)               |
| `utils.ts`               | File type detection, validation utilities |

## Patterns

### Using Crypto Utilities

```typescript
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
} from '../lib/crypto';

// Hash a password
const hash = await hashPassword('user-password');

// Verify a password
const isValid = await verifyPassword('user-password', hash);

// Generate secure tokens
const token = generateSecureToken(32); // 32 bytes of entropy
```

### Using the Permission System

```typescript
import {
  PERMISSIONS,
  PERMISSION_META,
  matchesPermission,
} from '../lib/permissions';

// Check permission
const hasAccess = matchesPermission(userPermissions, PERMISSIONS.USER_READ);

// Get permission metadata
const meta = PERMISSION_META['user:read'];
console.log(meta.label); // "View Users"
```

### Using Storage Adapters

```typescript
import { getStorageAdapter } from '../lib/storage';

const storage = getStorageAdapter();

// Upload a file
const { key, url } = await storage.upload(
  buffer,
  'path/to/file.pdf',
  'application/pdf',
);

// Get download URL
const downloadUrl = await storage.getSignedUrl(key, 3600); // 1 hour expiry

// Delete a file
await storage.delete(key);
```

### Custom Error Classes

```typescript
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '../lib/errors';

// Throw typed errors
throw new ValidationError('Invalid email format');
throw new NotFoundError('User not found');
throw new UnauthorizedError('Invalid credentials');

// Catch and handle
if (error instanceof AppError) {
  res.status(error.statusCode).json({ error: error.message });
}
```

### Sending Emails

```typescript
import { sendEmail } from '../lib/email';
import { getPasswordResetTemplate } from '../lib/email-templates';

await sendEmail({
  to: 'user@example.com',
  subject: 'Reset Your Password',
  html: getPasswordResetTemplate({ resetLink, userName }),
});
```

## Dependencies

- **argon2** - Password hashing
- **otplib** - TOTP generation and verification
- **@aws-sdk/client-ses** - Email sending
- **@aws-sdk/client-s3** - File storage
- **express-session** - Session middleware
- **oauth2-server** - OAuth 2.0 implementation

## Related

- [Middleware](../middleware/README.md) - Uses lib utilities
- [Services](../services/README.md) - Uses lib utilities
- [Configuration](../config/) - Environment-based configuration
