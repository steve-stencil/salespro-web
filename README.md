# SalesPro Web (pnpm + Turborepo)

### Requirements

- **Node**: `>= 20.11.0`
- **pnpm**: `>= 10.18.1`
- **PostgreSQL**: `>= 16`

### Monorepo layout

- `apps/api`: Express + PostgreSQL API (TypeScript, MikroORM)
- `apps/web`: React + Vite web app
- `packages/shared`: Shared TypeScript types and Zod schemas
- `packages/config`: Shared config (ESLint, Prettier, TS base)

See per-app guides:

- `apps/api/README.md` – API app usage and environment
- `apps/web/README.md` – Web app usage and environment

### One‑time setup

```bash
pnpm install
pnpm prepare # sets up husky
```

### Environment

You can either run `pnpm init-latest` (or `pnpm init-latest:conservative`) to auto-create the env files with defaults, or create them manually as below. The script will create `apps/api/.env` and `apps/web/.env` if they don't exist.

`apps/api/.env`

```bash
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salespro_dev"

# Optional
PORT=4000
NODE_ENV=development
SESSION_SECRET="your-session-secret-change-in-production"

# AWS Configuration (optional for development)
AWS_REGION="us-east-1"
AWS_PROFILE="salespro-dev"  # For local development credentials

# AWS KMS (required in production for credential encryption)
# Can be key ID, ARN, alias name, or alias ARN
KMS_KEY_ID="alias/salespro-credentials"
```

`apps/web/.env`

```bash
# Optional; defaults to http://localhost:4000/api
VITE_API_BASE="http://localhost:4000/api"
```

For cloud deployments, set `DATABASE_URL` to your PostgreSQL connection string.

### Run all apps (dev)

```bash
pnpm dev
```

- **Web**: `http://localhost:5173`
- **API** base: `http://localhost:4000/api`
  - Health: `GET /api/healthz`
  - Ready: `GET /api/readyz`

Example:

```bash
curl -s http://localhost:4000/api/healthz
```

### Useful scripts

- `pnpm dev`: Run all workspaces in dev via Turborepo
- `pnpm build`: Build all workspaces
- `pnpm test`: Run all tests with Vitest
- `pnpm test:integration`: Run integration tests
- `pnpm lint`: Lint all workspaces
- `pnpm typecheck`: Type-check all workspaces

### AI Development Helper Scripts

For AI agents working on this project:

- `pnpm ai:new-feature <name>`: Create a new feature branch
- `pnpm ai:check-setup`: Check project setup and dependencies
- `pnpm ai:check-health`: Run comprehensive health checks
- `pnpm ai:deploy-ready`: Prepare project for deployment
- `pnpm ai:clean`: Clean project (remove node_modules, dist, etc.)

### Development Workflows

- `pnpm workflow:ai`: Complete AI agent development workflow
- `pnpm workflow:user`: User development workflow
- `pnpm workflow:qa`: Quality assurance workflow
- `pnpm workflow:deploy`: Build and deploy workflow

See `docs/HELPER_SCRIPTS.md` for detailed usage instructions.

Workspace-specific scripts also exist under each package (e.g., `apps/api`, `apps/web`).

### Testing

The project uses Vitest as the primary testing framework with comprehensive coverage requirements:

- **Framework**: Vitest with built-in TypeScript support via Vite
- **Coverage**: 80% minimum coverage for branches, functions, lines, and statements
- **Test Structure**: Tests located in `__tests__` directories close to source files
- **API Testing**: Supertest for integration testing with mocked dependencies
- **Component Testing**: React Testing Library with Vitest for React components

Run tests:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific package
pnpm --filter api test
pnpm --filter web test
pnpm --filter @shared/core test
```

See `docs/DEVELOPMENT.md` for detailed testing patterns and examples.

### Updating all dependencies to latest

This repo ships a helper that installs, upgrades, and verifies:

```bash
# Aggressive: bump everything to latest (may include breaking versions)
pnpm init-latest

# Conservative: upgrade within semver ranges
pnpm init-latest:conservative
```

The script will:

1. install the workspace, 2) upgrade deps, 3) reinstall, 4) run lint/typecheck/tests.

### Docker

- **Compose**: `docker-compose.yml` provides `mongo`, `api`, and `web` services.
- **Ports**:
  - API: `4000` (mounts at `/api`)
  - Web: `5173`
  - PostgreSQL: `5432`

Build and run:

```bash
# Build images
docker compose build

# Run stack
docker compose up -d

# Logs
docker compose logs -f api
```

Environment used by compose:

- API: `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/salespro`, `PORT=4000`, `NODE_ENV=production`
- Web: `VITE_API_URL=http://localhost:4000`

Stop and clean:

```bash
docker compose down -v
```

### Notes

- The API mounts under `/api`. The web app uses `VITE_API_BASE` to find it.
- Shared DTOs/types live in `packages/shared` and are consumed by both API and Web via the `@shared/core` workspace package.
- Strict TypeScript is enforced; `any` is disallowed by ESLint and tsconfig.

### Troubleshooting

- **PostgreSQL connection fails**: Ensure PostgreSQL is running locally, or provide a valid `DATABASE_URL`.
- **Port in use**: Change `PORT` in `apps/api/.env` or `VITE_API_BASE` in `apps/web/.env`.
- **pnpm/version mismatch**: Check the required versions above and upgrade your local toolchain.

See `.cursor/rules/*` for project rules used by Cursor.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
