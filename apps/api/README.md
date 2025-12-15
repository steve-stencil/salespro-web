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
- `src/models/*` – MongoDB models
- `src/lib/db.ts` – database connection

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
