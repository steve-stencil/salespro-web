# SalesPro Web

Monorepo: Express API + React Web + Shared Types

## Quick Start

```bash
pnpm dev          # Run all (web :5173, api :4000)
pnpm test         # Run tests
pnpm lint         # Lint all
pnpm typecheck    # Type check
```

## Common Tasks

```bash
pnpm --filter api dev          # API only
pnpm --filter web dev          # Web only
pnpm test:integration          # Integration tests
pnpm db:migrate                # Run migrations
pnpm --filter api migration:create  # Create new migration
pnpm db:seed                   # Seed database
```

## Architecture

```
apps/api/         → Express + PostgreSQL + MikroORM
apps/web/         → React + Vite + MUI
packages/shared/  → Types (@shared/core)
```

## Database

- Entities: `apps/api/src/entities/`
- Migrations: `apps/api/src/migrations/`
- Seeds: `apps/api/scripts/seed*.ts`

## Critical Rules

- **TypeScript strict** - `any` is FORBIDDEN, use proper types
- **HTTP client** - ALWAYS use axios, never fetch()
- **Validation** - Use Zod for all request validation
- **Styling** - MUI only, no CSS files, use theme colors
- **Data fetching** - TanStack Query, never useEffect
- **Testing** - Vitest, 80% coverage minimum
- **Quality** - Fix ALL lint errors before completing tasks

## Avoid

- Don't use `fetch()` - use axios
- Don't use `useEffect` for data fetching - use TanStack Query
- Don't create CSS files - use MUI `sx` prop
- Don't use `any` type - define proper interfaces
- Don't skip lint/typecheck before completing tasks

## Detailed Rules

Read these files when working on related features:

| Topic             | File                                  |
| ----------------- | ------------------------------------- |
| Core conventions  | `.cursor/rules/core.mdc`              |
| API development   | `.cursor/rules/backend.mdc`           |
| Frontend/React    | `.cursor/rules/frontend.mdc`          |
| RBAC permissions  | `.cursor/rules/permissions.mdc`       |
| Testing standards | `.cursor/rules/testing.mdc`           |
| Security          | `.cursor/rules/security.mdc`          |
| Quality gates     | `.cursor/rules/quality-assurance.mdc` |

## Key Patterns

### API Route

```typescript
import { requireAuth, requirePermission } from '../middleware';
import { PERMISSIONS } from '../lib/permissions';

router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.RESOURCE_READ),
  handler,
);
```

### Shared Types

```typescript
import type { CurrentUser, Role } from '@shared/core';
```

### Environment

- API: `apps/api/.env` (DATABASE_URL, PORT, SESSION_SECRET)
- Web: `apps/web/.env` (VITE_API_BASE)

## Documentation

- `docs/ARCHITECTURE.md` - System design
- `docs/DEVELOPMENT.md` - Dev patterns
- `docs/SECURITY.md` - Security practices
- `README.md` - Setup guide
