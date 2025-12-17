## API app (Express + PostgreSQL + TypeScript)

This is the `apps/api` workspace of the monorepo. It exposes an Express server with routes under `/api` and connects to PostgreSQL.

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

### Shared packages

The API consumes shared types and schemas from `packages/shared`:

```ts
import { someSharedType } from '@shared/core';
```

### Troubleshooting

- PostgreSQL connection errors: ensure PostgreSQL is running, or use a valid `DATABASE_URL`.
- Port in use: change `PORT` in `.env`.
- Type issues: run `pnpm typecheck` at the root to see cross-workspace errors.
- Migration issues: run `pnpm db:migrate` to apply pending migrations.

### More info

- See the root `README.md` for requirements, environment setup, and scripts.
