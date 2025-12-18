# Services

## Purpose

This folder contains business logic services that encapsulate complex operations. Services are the layer between routes (HTTP handlers) and entities (data access), implementing business rules, validation, and orchestration.

## Structure

### Root Files

| File                   | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `index.ts`             | Service exports                                           |
| `AuthService.ts`       | Core authentication logic (login, logout, password reset) |
| `PermissionService.ts` | RBAC permission checking and role management              |
| `invite.ts`            | User invitation workflow                                  |

### Subfolders

#### `auth/`

Modular authentication components:

| File          | Purpose                                         |
| ------------- | ----------------------------------------------- |
| `index.ts`    | Auth module exports                             |
| `config.ts`   | Authentication configuration (timeouts, limits) |
| `types.ts`    | Authentication type definitions                 |
| `login.ts`    | Login flow logic                                |
| `password.ts` | Password validation and reset logic             |
| `mfa.ts`      | Multi-factor authentication logic               |
| `session.ts`  | Session management logic                        |
| `events.ts`   | Login event tracking and audit                  |

#### `file/`

File management service:

| File           | Purpose                         |
| -------------- | ------------------------------- |
| `index.ts`     | FileService class and exports   |
| `types.ts`     | File operation type definitions |
| `queries.ts`   | File query builders             |
| `thumbnail.ts` | Image thumbnail generation      |

#### `office-settings/`

Office settings management:

| File        | Purpose                                 |
| ----------- | --------------------------------------- |
| `index.ts`  | OfficeSettingsService class and exports |
| `types.ts`  | Settings type definitions and errors    |
| `config.ts` | Logo validation configuration           |

#### `office-integration/`

Third-party integration management with encryption:

| File       | Purpose                                    |
| ---------- | ------------------------------------------ |
| `index.ts` | OfficeIntegrationService class and exports |
| `types.ts` | Integration type definitions and errors    |

**Note:** Uses AWS KMS envelope encryption for credential storage. See [ADR-002](../../../docs/adr/ADR-002-credential-encryption.md).

## Patterns

### Using AuthService

```typescript
import { AuthService } from '../services';

const authService = new AuthService(em);

// Login
const result = await authService.login({
  email: 'user@example.com',
  password: 'password123',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

if (result.success) {
  // Handle successful login
  req.session.userId = result.user.id;
}

// Request password reset
await authService.requestPasswordReset('user@example.com');

// Reset password
await authService.resetPassword(token, newPassword);
```

### Using PermissionService

```typescript
import { PermissionService } from '../services';

const permissionService = new PermissionService(em);

// Check single permission
const canRead = await permissionService.hasPermission(
  userId,
  'user:read',
  companyId,
);

// Check multiple permissions (AND)
const canManage = await permissionService.hasAllPermissions(
  userId,
  ['user:read', 'user:update'],
  companyId,
);

// Get user's permissions
const permissions = await permissionService.getUserPermissions(
  userId,
  companyId,
);

// Assign role to user
await permissionService.assignRole(userId, roleId, companyId, assignedByUserId);
```

### Using FileService

```typescript
import { FileService } from '../services';

const fileService = new FileService(em, storage);

// Upload file
const file = await fileService.upload({
  buffer: fileBuffer,
  filename: 'document.pdf',
  mimeType: 'application/pdf',
  size: fileBuffer.length,
  companyId,
  uploadedById,
  visibility: 'company',
});

// Get presigned upload URL (for direct S3 upload)
const { uploadUrl, fileId, key } = await fileService.presignUpload({
  filename: 'large-file.zip',
  mimeType: 'application/zip',
  size: 100000000,
  companyId,
  uploadedById,
});

// List files with pagination
const { files, total } = await fileService.list({
  companyId,
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

### Using Invite Service

```typescript
import { createInvite, acceptInvite, validateInviteToken } from '../services';

// Create invite
const result = await createInvite(em, {
  email: 'newuser@example.com',
  companyId,
  invitedById,
  roleId,
  officeIds: ['office-1', 'office-2'],
});

// Validate invite token
const validation = await validateInviteToken(em, token);
if (validation.valid) {
  // Show registration form
}

// Accept invite (creates user account)
const { user } = await acceptInvite(em, {
  token,
  firstName: 'John',
  lastName: 'Doe',
  password: 'securePassword123',
});
```

### Using OfficeSettingsService

```typescript
import { OfficeSettingsService } from '../services';

const settingsService = new OfficeSettingsService(em);

// Get settings (creates if not exists)
const settings = await settingsService.getSettings(officeId, companyId);

// Upload logo
const updated = await settingsService.updateLogo({
  officeId,
  companyId,
  file: { buffer, filename: 'logo.png', mimeType: 'image/png' },
  user: { id: userId, company: { id: companyId } },
});

// Remove logo
await settingsService.removeLogo(officeId, companyId);
```

### Using OfficeIntegrationService

```typescript
import { OfficeIntegrationService } from '../services';

const integrationService = new OfficeIntegrationService(em);

// List integrations
const integrations = await integrationService.listIntegrations(
  officeId,
  companyId,
  { enabledOnly: true },
);

// Create/update integration with encrypted credentials
const integration = await integrationService.upsertIntegration({
  officeId,
  companyId,
  integrationKey: 'salesforce',
  displayName: 'Salesforce CRM',
  credentials: { clientId: 'xxx', clientSecret: 'yyy' },
  config: { instanceUrl: 'https://mycompany.salesforce.com' },
  isEnabled: true,
});

// Get integration with decrypted credentials (use sparingly)
const withCreds = await integrationService.getDecryptedCredentials(
  officeId,
  companyId,
  'salesforce',
);

// Delete integration
await integrationService.deleteIntegration(officeId, companyId, 'salesforce');
```

## Service Design Principles

### 1. Single Responsibility

Each service handles one domain area:

- `AuthService` - Authentication only
- `PermissionService` - Authorization only
- `FileService` - File operations only

### 2. Dependency Injection

Services receive their dependencies (EntityManager, storage adapters) through constructors:

```typescript
class MyService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: StorageAdapter,
  ) {}
}
```

### 3. Transaction Management

Services use the EntityManager for transaction support:

```typescript
async createWithRelations(data: CreateData): Promise<Entity> {
  const entity = this.em.create(Entity, data);
  await this.em.persistAndFlush(entity);
  return entity;
}
```

### 4. Error Handling

Services throw typed errors that routes can catch and convert to HTTP responses:

```typescript
import { ValidationError, NotFoundError } from '../lib/errors';

if (!user) {
  throw new NotFoundError('User not found');
}
```

## Dependencies

- **MikroORM EntityManager** - Database operations
- **Lib utilities** - Crypto, email, storage
- **Entities** - Data models

## Related

- [Routes](../routes/README.md) - HTTP layer that calls services
- [Entities](../entities/README.md) - Data models
- [Lib](../lib/README.md) - Utility functions
- [Middleware](../middleware/README.md) - Request preprocessing
