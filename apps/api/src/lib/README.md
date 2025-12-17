# API Library Utilities

This folder contains shared utility modules used throughout the API application.

## Modules

### `crypto.ts` - Password Hashing

Argon2-based password hashing utilities.

```typescript
import { hashPassword, verifyPassword } from './crypto';

const hash = await hashPassword('user-password');
const isValid = await verifyPassword('user-password', hash);
```

### `db.ts` - Database Connection

MikroORM database connection management.

```typescript
import { getORM, initORM } from './db';

// Initialize on startup
await initORM();

// Get ORM instance in routes/services
const orm = getORM();
const em = orm.em.fork();
```

### `kms.ts` - AWS KMS Integration

AWS Key Management Service for envelope encryption.

```typescript
import { generateDataKey, decryptDataKey, isKmsConfigured } from './kms';

// Generate a new data key for encryption
const { plaintextKey, encryptedKey } = await generateDataKey();

// Decrypt a stored data key
const plaintextKey = await decryptDataKey(encryptedKey);
```

**Features:**

- Master key never leaves AWS HSM
- Automatic key rotation support
- Full audit trail in CloudTrail
- IAM-based access control

### `encryption.ts` - Local AES Encryption

AES-256-GCM encryption for use with KMS data keys.

```typescript
import { encrypt, decrypt, generateRandomKey } from './encryption';

// Encrypt with a data key from KMS
const ciphertext = encrypt(plaintext, dataKey);
const plaintext = decrypt(ciphertext, dataKey);
```

**Ciphertext Format:** `{iv}:{authTag}:{encrypted}` (all base64)

See [ADR-001](../../../docs/adr/ADR-001-credential-encryption.md) for architecture details.

### `email.ts` - Email Sending

AWS SES email sending utilities.

```typescript
import { sendEmail } from './email';

await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<p>Welcome to SalesPro!</p>',
});
```

### `email-templates.ts` - Email Templates

Pre-built email templates for common scenarios.

```typescript
import {
  getPasswordResetEmailTemplate,
  getWelcomeEmailTemplate,
  getInviteEmailTemplate,
} from './email-templates';
```

### `errors.ts` - Error Classes

Typed error classes for consistent error handling.

```typescript
import { AppError, NotFoundError, ValidationError } from './errors';

throw new NotFoundError('User not found');
throw new ValidationError('Invalid email format');
```

### `permissions.ts` - RBAC Permissions

Permission constants and utilities for role-based access control.

```typescript
import { PERMISSIONS, hasPermission, matchPermission } from './permissions';

// Check if user has permission
if (hasPermission('customer:read', userPermissions)) {
  // Allow access
}

// Wildcard matching
matchPermission('customer:read', 'customer:*'); // true
matchPermission('customer:read', '*'); // true
```

## Subfolders

### `oauth/` - OAuth 2.0 Implementation

OAuth server implementation with PKCE support.

- `model.ts` - OAuth data model
- `pkce.ts` - PKCE utilities
- `scopes.ts` - Scope definitions

### `session/` - Session Management

Express session with MikroORM store.

- `index.ts` - Session configuration
- `middleware.ts` - Session middleware
- `MikroOrmStore.ts` - Custom session store

### `storage/` - File Storage

Pluggable file storage adapters.

- `index.ts` - Storage factory
- `LocalStorageAdapter.ts` - Local filesystem storage
- `S3StorageAdapter.ts` - AWS S3 storage
- `types.ts` - Storage interfaces
- `utils.ts` - File utilities

## Environment Variables

| Variable         | Description                         | Required       |
| ---------------- | ----------------------------------- | -------------- |
| `DATABASE_URL`   | PostgreSQL connection string        | Yes            |
| `SESSION_SECRET` | Secret for session cookies          | Production     |
| `KMS_KEY_ID`     | AWS KMS key ID/alias for encryption | Production     |
| `AWS_REGION`     | AWS region for KMS/SES/S3           | Yes            |
| `AWS_PROFILE`    | AWS profile for credentials         | Local dev      |
| `SES_FROM_EMAIL` | Verified sender email               | For email      |
| `S3_BUCKET`      | S3 bucket name                      | For S3 storage |

## Related

- [Architecture Documentation](../../../docs/ARCHITECTURE.md)
- [ADR-001: Credential Encryption](../../../docs/adr/ADR-001-credential-encryption.md)
