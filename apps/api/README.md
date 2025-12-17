## API app (Express + MongoDB + TypeScript)

This is the `apps/api` workspace of the monorepo. It exposes an Express server with routes under `/api` and connects to MongoDB.

### Run (recommended from repo root)

From the monorepo root, start everything in dev mode:

```bash
pnpm dev
```

- API base: `http://localhost:4000/api`
  - Health: `GET /api/healthz`
  - Ready: `GET /api/readyz`

Run only the API app:

```bash
pnpm --filter api dev
```

### Environment

Create `apps/api/.env` with at least:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salespro_dev"
# Optional
PORT=4000
NODE_ENV=development
SESSION_SECRET="your-session-secret-change-in-production"

# AWS Configuration (shared with SES)
AWS_REGION="us-east-1"

# File Storage (optional - uses local storage if not set)
# Set S3_BUCKET to enable S3 storage in production
S3_BUCKET="your-bucket-name"
S3_REGION="us-east-1"  # defaults to AWS_REGION if not set

# File Upload Limits
MAX_FILE_SIZE_MB=10  # Maximum file size in MB (default: 10)
ALLOWED_FILE_TYPES="image/*,application/pdf,.doc,.docx,.xls,.xlsx"

# AWS KMS (required for integration credentials)
# Can be key ID, ARN, alias name, or alias ARN
KMS_KEY_ID="alias/salespro-credentials"
```

### Database Setup

The API uses PostgreSQL with MikroORM. Before starting the server for the first time:

#### 1. Run Migrations

Apply all database migrations to create the schema:

```bash
pnpm db:migrate
# or from this directory
pnpm migration:up
```

#### 2. Seed the Database

Create the initial admin user and company:

```bash
pnpm db:seed
# or from this directory
pnpm db:seed
```

This creates:

- **Company**: "SalesPro Demo Company" (Professional tier)
- **Admin User**: `admin@salespro.dev` / `SalesProAdmin123!`

To reseed (clear and recreate):

```bash
pnpm db:seed:force
```

See [docs/DATABASE_SEEDING.md](../../docs/DATABASE_SEEDING.md) for full documentation.

### Scripts (workspace)

**Development:**

- `pnpm --filter api dev` – start the dev server
- `pnpm --filter api build` – type-check and build
- `pnpm --filter api lint` – lint the project
- `pnpm --filter api typecheck` – run TypeScript checks
- `pnpm --filter api test` – run tests

**Database:**

- `pnpm db:seed` – seed the database with initial data
- `pnpm db:seed:force` – clear and reseed the database
- `pnpm db:migrate` – run database migrations
- `pnpm --filter api migration:create` – create a new migration
- `pnpm --filter api migration:up` – apply pending migrations
- `pnpm --filter api migration:down` – rollback last migration

The same scripts exist in this workspace and can be run with `pnpm <script>` after `cd apps/api`.

### Structure

- `src/server.ts` – create and start the server
- `src/index.ts` – app bootstrap and route mounting
- `src/routes/*` – route handlers (`/api` prefix)
- `src/entities/*` – MikroORM entities
- `src/services/*` – business logic services
- `src/lib/db.ts` – database connection
- `src/lib/storage/*` – file storage adapters (S3, local)

### File Upload System

The API includes a file upload system with pluggable storage backends:

- **Local Storage**: Files are stored in `./uploads/` during development
- **S3 Storage**: Files are stored in AWS S3 when `S3_BUCKET` is configured

#### Storage Structure

Files are organized by company ID for multi-tenant isolation:

```
{companyId}/files/{uuid}.{ext}
{companyId}/thumbnails/{uuid}_thumb.{ext}
```

#### File Upload Endpoints

| Method | Endpoint                   | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| POST   | `/api/files/upload`        | Upload file via multipart form         |
| POST   | `/api/files/presign`       | Get presigned URL for direct S3 upload |
| POST   | `/api/files/confirm`       | Confirm presigned upload completed     |
| GET    | `/api/files`               | List files with pagination             |
| GET    | `/api/files/:id`           | Get file metadata                      |
| GET    | `/api/files/:id/download`  | Get download URL                       |
| GET    | `/api/files/:id/thumbnail` | Get thumbnail URL (images only)        |
| PATCH  | `/api/files/:id`           | Update file metadata                   |
| DELETE | `/api/files/:id`           | Soft delete file                       |

#### File Visibility

Files support three visibility levels:

- `private` - Only the uploader can access
- `company` - All users in the same company can access (default)
- `public` - Publicly accessible

#### Required Permissions

- `file:read` - View and download files
- `file:create` - Upload files
- `file:update` - Update file metadata
- `file:delete` - Delete files

### Office Settings System

The API includes office-level settings for managing logos and third-party integrations.

#### Office Settings Endpoints

| Method | Endpoint                         | Description               |
| ------ | -------------------------------- | ------------------------- |
| GET    | `/api/offices/:id/settings`      | Get office settings       |
| POST   | `/api/offices/:id/settings/logo` | Upload/update office logo |
| DELETE | `/api/offices/:id/settings/logo` | Remove office logo        |

**Required Permissions:** `office:read` for GET, `settings:update` for POST/DELETE

#### Office Integrations Endpoints

| Method | Endpoint                             | Description               |
| ------ | ------------------------------------ | ------------------------- |
| GET    | `/api/offices/:id/integrations`      | List all integrations     |
| GET    | `/api/offices/:id/integrations/:key` | Get specific integration  |
| PUT    | `/api/offices/:id/integrations/:key` | Create/update integration |
| DELETE | `/api/offices/:id/integrations/:key` | Delete integration        |

**Required Permissions:** `settings:read` for GET, `settings:update` for PUT/DELETE

#### Integration Credentials

Integration credentials are encrypted using AWS KMS envelope encryption:

- KMS generates unique data keys for each integration
- Data is encrypted locally with AES-256-GCM
- Master key never leaves AWS HSM
- Automatic key rotation supported

The `KMS_KEY_ID` environment variable is required for credential storage.

Example integration request:

```json
{
  "displayName": "Salesforce CRM",
  "credentials": {
    "clientId": "xxx",
    "clientSecret": "yyy"
  },
  "config": {
    "instanceUrl": "https://mycompany.salesforce.com"
  },
  "isEnabled": true
}
```

**Note:** Credentials are never returned in API responses. Only `hasCredentials: true/false` is returned.

See [ADR-001: Credential Encryption](../../docs/adr/ADR-001-credential-encryption.md) for encryption architecture.

### Shared packages

The API consumes shared types and schemas from `packages/shared`:

```ts
import { someSharedType } from '@shared/core';
```

### Troubleshooting

- Mongo connection errors: ensure `mongod` is running, or use a valid `MONGODB_URI`.
- Port in use: change `PORT` in `.env`.
- Type issues: run `pnpm typecheck` at the root to see cross-workspace errors.

### More info

- See the root `README.md` for requirements, environment setup, and scripts.
