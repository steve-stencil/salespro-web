# Routes

## Purpose

This folder contains all API route handlers. Routes define HTTP endpoints, handle request/response formatting, validation, and delegate business logic to services.

## Structure

### Root Files

| File                | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `index.ts`          | Main router that mounts all sub-routers    |
| `companies.ts`      | Company settings endpoints                 |
| `internal-users.ts` | Internal (platform) user management        |
| `invites.ts`        | User invitation endpoints                  |
| `offices.ts`        | Office management endpoints                |
| `platform.ts`       | Platform-level operations (internal users) |
| `platform-roles.ts` | Platform role CRUD (admin only)            |
| `roles.ts`          | Role and permission management             |
| `users.ts`          | User management endpoints                  |

### Subfolders

#### `auth/`

Authentication endpoints:

| File                 | Purpose                    |
| -------------------- | -------------------------- |
| `index.ts`           | Auth router setup          |
| `login.routes.ts`    | Login/logout endpoints     |
| `password.routes.ts` | Password reset flow        |
| `mfa.routes.ts`      | MFA setup and verification |
| `session.routes.ts`  | Session management         |
| `schemas.ts`         | Zod validation schemas     |
| `utils.ts`           | Auth route utilities       |

#### `files/`

File management endpoints:

| File               | Purpose                 |
| ------------------ | ----------------------- |
| `index.ts`         | File router setup       |
| `upload.routes.ts` | File upload endpoints   |
| `list.routes.ts`   | File listing and search |
| `manage.routes.ts` | File CRUD operations    |
| `schemas.ts`       | Zod validation schemas  |
| `utils.ts`         | File route utilities    |

#### `oauth/`

OAuth 2.0 endpoints:

| File                  | Purpose                 |
| --------------------- | ----------------------- |
| `index.ts`            | OAuth router setup      |
| `authorize.routes.ts` | Authorization endpoints |
| `token.routes.ts`     | Token endpoints         |
| `schemas.ts`          | Zod validation schemas  |
| `utils.ts`            | OAuth utilities         |

#### `office-settings/`

Office-level settings and integrations:

| File                     | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `index.ts`               | Combined router for settings and integrations |
| `settings.routes.ts`     | Office settings (logo upload/remove)          |
| `integrations.routes.ts` | Third-party integration CRUD with encryption  |
| `schemas.ts`             | Zod validation schemas for integrations       |

## API Endpoint Reference

### Health Checks

| Method | Endpoint       | Description     |
| ------ | -------------- | --------------- |
| GET    | `/api/healthz` | Liveness check  |
| GET    | `/api/readyz`  | Readiness check |

### Authentication (`/api/auth`)

| Method | Endpoint                       | Description               |
| ------ | ------------------------------ | ------------------------- |
| POST   | `/auth/login`                  | User login                |
| POST   | `/auth/logout`                 | User logout               |
| GET    | `/auth/me`                     | Get current user          |
| POST   | `/auth/password/reset-request` | Request password reset    |
| POST   | `/auth/password/reset`         | Reset password with token |
| POST   | `/auth/mfa/setup`              | Initialize MFA setup      |
| POST   | `/auth/mfa/verify`             | Verify MFA code           |
| POST   | `/auth/mfa/disable`            | Disable MFA               |

### Users (`/api/users`)

| Method | Endpoint                   | Description                |
| ------ | -------------------------- | -------------------------- |
| GET    | `/users`                   | List users (paginated)     |
| GET    | `/users/:id`               | Get user details           |
| PATCH  | `/users/:id`               | Update user                |
| DELETE | `/users/:id`               | Deactivate user            |
| POST   | `/users/:id/activate`      | Activate user              |
| GET    | `/users/me/companies`      | List user's companies      |
| GET    | `/users/me/active-company` | Get current active company |
| POST   | `/users/me/switch-company` | Switch to another company  |
| PATCH  | `/users/me/companies/:id`  | Pin/unpin a company        |

### Invites (`/api/invites`, `/api/users/invites`)

| Method | Endpoint                 | Description           |
| ------ | ------------------------ | --------------------- |
| POST   | `/users/invites`         | Create invitation     |
| GET    | `/users/invites`         | List pending invites  |
| DELETE | `/users/invites/:id`     | Revoke invitation     |
| GET    | `/invites/:token`        | Validate invite token |
| POST   | `/invites/:token/accept` | Accept invitation     |

### Roles (`/api/roles`)

| Method | Endpoint     | Description                    |
| ------ | ------------ | ------------------------------ |
| GET    | `/roles`     | List roles                     |
| GET    | `/roles/me`  | Get current user's permissions |
| POST   | `/roles`     | Create role                    |
| PATCH  | `/roles/:id` | Update role                    |
| DELETE | `/roles/:id` | Delete role                    |

### Offices (`/api/offices`)

| Method | Endpoint       | Description   |
| ------ | -------------- | ------------- |
| GET    | `/offices`     | List offices  |
| POST   | `/offices`     | Create office |
| PATCH  | `/offices/:id` | Update office |
| DELETE | `/offices/:id` | Delete office |

### Office Settings (`/api/offices/:id/settings`)

| Method | Endpoint                     | Description               |
| ------ | ---------------------------- | ------------------------- |
| GET    | `/offices/:id/settings`      | Get office settings       |
| POST   | `/offices/:id/settings/logo` | Upload/update office logo |
| DELETE | `/offices/:id/settings/logo` | Remove office logo        |

### Office Integrations (`/api/offices/:id/integrations`)

| Method | Endpoint                         | Description               |
| ------ | -------------------------------- | ------------------------- |
| GET    | `/offices/:id/integrations`      | List all integrations     |
| GET    | `/offices/:id/integrations/:key` | Get specific integration  |
| PUT    | `/offices/:id/integrations/:key` | Create/update integration |
| DELETE | `/offices/:id/integrations/:key` | Delete integration        |

**Note:** Integration credentials are encrypted using AWS KMS envelope encryption. Credentials are never returned in API responses; only `hasCredentials: true/false` is included.

### Files (`/api/files`)

| Method | Endpoint              | Description              |
| ------ | --------------------- | ------------------------ |
| POST   | `/files/upload`       | Upload file              |
| POST   | `/files/presign`      | Get presigned upload URL |
| POST   | `/files/confirm`      | Confirm presigned upload |
| GET    | `/files`              | List files               |
| GET    | `/files/:id`          | Get file metadata        |
| GET    | `/files/:id/download` | Get download URL         |
| PATCH  | `/files/:id`          | Update file metadata     |
| DELETE | `/files/:id`          | Soft delete file         |

### Companies (`/api/companies`)

| Method | Endpoint             | Description             |
| ------ | -------------------- | ----------------------- |
| GET    | `/companies/current` | Get current company     |
| PATCH  | `/companies/current` | Update company settings |

### Platform (`/api/platform`) - Internal Users Only

| Method | Endpoint                   | Description           |
| ------ | -------------------------- | --------------------- |
| GET    | `/platform/companies`      | List all companies    |
| POST   | `/platform/switch-company` | Switch active company |
| GET    | `/platform/active-company` | Get active company    |
| DELETE | `/platform/active-company` | Exit company context  |

### Platform Roles (`/api/platform/roles`) - Platform Admin Only

| Method | Endpoint              | Description                        |
| ------ | --------------------- | ---------------------------------- |
| GET    | `/platform/roles`     | List all platform roles with count |
| GET    | `/platform/roles/:id` | Get platform role details          |
| POST   | `/platform/roles`     | Create a new platform role         |
| PATCH  | `/platform/roles/:id` | Update a platform role             |
| DELETE | `/platform/roles/:id` | Delete a platform role             |

**Note:** Platform roles define permissions for internal users. Each role has:

- `permissions` - Platform-level permissions (e.g., `platform:admin`)
- `companyPermissions` - Permissions when viewing a company's data (can include `*` for full access)

### Internal Users (`/api/internal-users`) - Platform Admin Only

| Method | Endpoint                                   | Description                      |
| ------ | ------------------------------------------ | -------------------------------- |
| GET    | `/internal-users`                          | List internal users              |
| POST   | `/internal-users`                          | Create internal user             |
| GET    | `/internal-users/:id`                      | Get internal user details        |
| PATCH  | `/internal-users/:id`                      | Update internal user             |
| DELETE | `/internal-users/:id`                      | Soft delete internal user        |
| GET    | `/internal-users/roles`                    | List platform roles              |
| GET    | `/internal-users/:id/companies`            | List user's company restrictions |
| POST   | `/internal-users/:id/companies`            | Add company restriction          |
| DELETE | `/internal-users/:id/companies/:companyId` | Remove company restriction       |

## Patterns

### Route Handler Structure

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware';
import { PERMISSIONS } from '../lib/permissions';
import { MyService } from '../services';

const router = Router();

// Define validation schema
const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

// Route handler
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.RESOURCE_CREATE),
  async (req, res, next) => {
    try {
      // Validate input
      const data = createSchema.parse(req.body);

      // Call service
      const service = new MyService(req.em);
      const result = await service.create(data);

      // Return response
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
```

### Request Validation with Zod

```typescript
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

router.get('/', async (req, res) => {
  const { page, limit, search } = querySchema.parse(req.query);
  // ...
});
```

### Error Handling

Routes use a centralized error handler. Throw errors and let middleware handle them:

```typescript
router.get('/:id', async (req, res, next) => {
  try {
    const item = await service.findById(req.params.id);
    if (!item) {
      throw new NotFoundError('Item not found');
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});
```

## Dependencies

- **Express** - HTTP framework
- **Zod** - Request validation
- **Middleware** - Auth, permissions, uploads
- **Services** - Business logic

## Related

- [Middleware](../middleware/README.md) - Request preprocessing
- [Services](../services/README.md) - Business logic
- [API Documentation](../../../../docs/) - Full API docs
