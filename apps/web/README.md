## Web app (React + TypeScript + Vite)

This is the `apps/web` workspace of the monorepo. It is a Vite + React app written in TypeScript and configured to work with the shared packages and tooling provided in the repository.

### Run (recommended from repo root)

From the monorepo root, start everything in dev mode:

```bash
pnpm dev
```

- Web: `http://localhost:5173`
- API base: `http://localhost:4000/api`

Run only the web app:

```bash
pnpm --filter web dev
```

### Environment

Create `apps/web/.env` if needed:

```bash
# Optional; defaults to http://localhost:4000/api
VITE_API_BASE="http://localhost:4000/api"
```

The app reads `VITE_API_BASE` to call the API (mounted under `/api`). See the root `README.md` for full environment setup and API env variables.

### Scripts (workspace)

All scripts can be run via pnpm workspace filtering or inside this directory:

- `pnpm --filter web dev` – start the dev server
- `pnpm --filter web build` – type-check and build for production
- `pnpm --filter web preview` – preview the production build
- `pnpm --filter web lint` – lint the project
- `pnpm --filter web typecheck` – run TypeScript type checks
- `pnpm --filter web test` – run unit tests
- `pnpm --filter web test:e2e` – run E2E tests with Playwright
- `pnpm --filter web test:e2e:ui` – run E2E tests with Playwright UI
- `pnpm --filter web test:e2e:headed` – run E2E tests in headed browser mode

The same scripts exist in this workspace and can be run with `pnpm <script>` after `cd apps/web`.

### E2E Testing with Playwright

The app includes browser-based E2E tests using Playwright. Tests are located in the `e2e/` directory.

```bash
# Run all E2E tests (headless)
pnpm --filter web test:e2e

# Run with Playwright UI for debugging
pnpm --filter web test:e2e:ui

# Run in headed mode (visible browser)
pnpm --filter web test:e2e:headed
```

**Note:** E2E tests require both the web app and API to be running. The Playwright config will automatically start the dev server when running tests locally.

### Shared packages

This app consumes shared types and schemas from `packages/shared`. Example import:

```ts
import { someTypeOrUtil } from '@shared/core';
```

Refer to the root `README.md` for details on shared package boundaries and publishing within the monorepo.

### Linting and TypeScript

- TypeScript is strict and `any` is disallowed by project policy.
- ESLint and TypeScript base configs are provided by `packages/config`.
- Use the root scripts for consistency across workspaces: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

### Troubleshooting

- API requests 404 or fail: verify the API is running and that `VITE_API_BASE` points to the correct URL.
- Port in use: change the dev server port via Vite config or stop the conflicting process.
- Stale deps/HMR issues: remove `node_modules` and `pnpm-lock.yaml`, then `pnpm install` at the repo root.

### More info

- See the root `README.md` for requirements, workspace layout, and common scripts.
- API health endpoints: `GET /api/healthz`, `GET /api/readyz` (when the API app is running).
