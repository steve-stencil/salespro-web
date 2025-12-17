# Integration Testing Guide

This document explains how to run and write integration tests for SalesPro Web.

## Overview

Integration tests verify that different parts of the application work together correctly. Unlike unit tests that test individual components in isolation, integration tests test the interaction between components, APIs, and external services.

## Test Structure

### API Integration Tests

- **Location**: `apps/api/src/__tests__/integration/`
- **Configuration**: `apps/api/vitest.integration.config.ts`
- **Setup**: Uses PostgreSQL test container for real database testing
- **Scope**: Tests API endpoints with real database connections

### Web Integration Tests

- **Location**: `apps/web/src/__tests__/integration/`
- **Configuration**: `apps/web/vitest.integration.config.ts`
- **Setup**: Uses jsdom environment with mocked API calls
- **Scope**: Tests React components with API interactions

## Running Integration Tests

### Run All Integration Tests

```bash
# From project root
pnpm test:integration

# Or run specific app
cd apps/api && pnpm test:integration
cd apps/web && pnpm test:integration
```

### Run Integration Tests in Watch Mode

```bash
# API integration tests
cd apps/api && pnpm test:integration:watch

# Web integration tests
cd apps/web && pnpm test:integration:watch
```

### Run Specific Integration Test Files

```bash
# API
cd apps/api && pnpm vitest run --config vitest.integration.config.ts src/__tests__/integration/users.test.ts

# Web
cd apps/web && pnpm vitest run --config vitest.integration.config.ts src/__tests__/integration/App.test.tsx
```

## Writing Integration Tests

### API Integration Tests

#### Setup

API integration tests use a PostgreSQL test container to provide a real database connection:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp, makeRequest } from './helpers';

describe('API Integration Tests', () => {
  beforeEach(async () => {
    const app = await getTestApp();
    // Database is automatically connected via setup.ts
  });

  it('should return health status', async () => {
    const response = await makeRequest().get('/api/healthz').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});
```

#### Available Helpers

- `getTestApp()`: Returns the Express app instance
- `makeRequest()`: Returns a supertest request instance
- `waitForDatabase()`: Waits for database connection

### Web Integration Tests

#### Setup

Web integration tests use jsdom and mock API calls:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen, userEvent } from "./helpers";
import App from "../../App";

describe("App Integration Tests", () => {
  it("should increment counter when button is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);

    const button = screen.getByRole("button", { name: /count is 0/i });

    // Click the button
    await user.click(button);

    // Counter should increment
    expect(screen.getByRole("button", { name: /count is 1/i })).toBeInTheDocument();
  });
});
```

#### Available Helpers

- `render(component)`: Renders React components with providers
- All React Testing Library utilities are available

## Test Categories

### API Integration Tests

1. **API Health Checks** (`api.test.ts`)
   - Health check endpoints (`/api/healthz`, `/api/readyz`)
   - Error handling for non-existent endpoints
   - CORS and security headers
   - Request logging

### Web Integration Tests

1. **App Component** (`App.test.tsx`)
   - Main app rendering
   - Counter functionality
   - User interactions (button clicks)
   - Logo links and navigation

## Best Practices

### 1. Test Real Scenarios

- Test complete user workflows
- Include error scenarios
- Test edge cases and validation

### 2. Use Real Dependencies

- API tests use real database (PostgreSQL test container)
- Web tests mock API calls but test real component interactions
- Avoid over-mocking

### 3. Clean Up After Tests

- Database is automatically cleaned between tests
- Mock functions are reset in beforeEach
- No shared state between tests

### 4. Meaningful Assertions

- Test behavior, not implementation
- Verify side effects (database changes, API calls)
- Check error handling

### 5. Performance Considerations

- Integration tests are slower than unit tests
- Use appropriate timeouts (30 seconds default)
- Run integration tests separately from unit tests

## Configuration

### API Integration Test Configuration

```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/integration/setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 30000, // 30 seconds
    hookTimeout: 30000,
  },
});
```

### Web Integration Test Configuration

```typescript
// vitest.integration.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/integration/setup.ts'],
    include: ['src/__tests__/integration/**/*.test.tsx'],
    testTimeout: 30000, // 30 seconds
    hookTimeout: 30000,
  },
});
```

## Troubleshooting

### Common Issues

1. **Database Connection Timeout**
   - Ensure PostgreSQL test container is running: `docker-compose -f docker-compose.test.yml up -d`
   - Check that no other PostgreSQL instance is using port 5433

2. **Test Timeouts**
   - Increase timeout values in vitest config
   - Check for infinite loops or hanging promises

3. **Mock Issues**
   - Ensure mocks are properly reset between tests
   - Check that mock implementations match expected API contracts

4. **Environment Variables**
   - Integration tests use test-specific environment variables
   - Check setup files for proper configuration

### Debugging Tips

1. **Run Single Tests**

   ```bash
   pnpm vitest run --config vitest.integration.config.ts --reporter=verbose src/__tests__/integration/users.test.ts
   ```

2. **Enable Debug Logging**

   ```bash
   DEBUG=* pnpm test:integration
   ```

3. **Check Database State**
   - Use database inspection tools
   - Add console.log statements in test helpers

## CI/CD Integration

Integration tests should be run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: |
    pnpm install
    pnpm test:integration
```

Consider running integration tests:

- On pull requests
- Before merging to main
- In staging environments
- With different database configurations
