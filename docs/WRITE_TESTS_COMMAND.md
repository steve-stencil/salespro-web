# Write Tests Command

When asked to write tests, follow this comprehensive guide to determine the appropriate test type, structure, and implementation patterns for this codebase.

---

## Test Type Decision Matrix

### When to Write E2E Tests (Playwright)

Write Playwright E2E tests when:

- **Testing complete user flows** (login → navigate → perform action → verify result)
- **Testing critical business paths** that span multiple pages/components
- **Testing authentication flows** (login, logout, MFA, password reset)
- **Testing navigation and routing** behavior
- **Testing accessibility compliance** (keyboard navigation, ARIA labels)
- **Testing form submissions** with validation across the full stack
- **Testing features that require a real browser** (cookies, local storage, redirects)

**Location**: `apps/web/e2e/*.spec.ts`

---

### When to Write Integration Tests

Write integration tests when:

- **Testing API endpoints** with real database interactions
- **Testing authentication/authorization** on API routes
- **Testing middleware behavior** with realistic request/response cycles
- **Testing service interactions** that span multiple components
- **Testing database operations** including transactions
- **Testing external service integrations** (with mocked external calls)

**Location**: `apps/api/src/__tests__/integration/*.test.ts`

---

### When to Write Unit Tests

Write unit tests when:

- **Testing pure functions** and utility helpers
- **Testing business logic** in isolation
- **Testing individual service methods** with mocked dependencies
- **Testing validation functions** and schema parsing
- **Testing React components** in isolation (with Testing Library)
- **Testing error handling** and edge cases

**Location**: `apps/api/src/__tests__/**/*.test.ts` or `apps/web/src/**/__tests__/*.test.ts`

---

## E2E Test Structure (Playwright)

### File Setup Template

```typescript
import { test, expect } from '@playwright/test';

/**
 * E2E tests for [Feature Name].
 * These tests verify [describe what the tests verify].
 */

test.describe('[Feature Name]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path');
  });

  test.describe('[Sub-feature or Scenario]', () => {
    test('should [expected behavior]', async ({ page }) => {
      // Arrange: Set up test state
      // Act: Perform user actions
      // Assert: Verify expected outcomes
    });
  });
});
```

### What to Include in E2E Tests

#### 1. Page Display Tests

- Verify all critical elements are visible
- Check headings, form elements, buttons, links
- Verify proper labeling and text content

```typescript
test('should display the login form with all elements', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: 'Welcome Back' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email Address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});
```

#### 2. Form Validation Tests

- Test empty form submission
- Test invalid input formats
- Test error message display and clearing

```typescript
test('should show error when submitting empty form', async ({ page }) => {
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('Email is required')).toBeVisible();
});

test('should clear field errors when user starts typing', async ({ page }) => {
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('Email is required')).toBeVisible();
  await page.getByLabel('Email Address').fill('test@example.com');
  await expect(page.getByText('Email is required')).not.toBeVisible();
});
```

#### 3. User Interaction Tests

- Test clicking, typing, selecting
- Test toggle behaviors (password visibility, checkboxes)
- Test keyboard interactions

```typescript
test('should toggle password visibility', async ({ page }) => {
  const passwordInput = page.locator('#password');
  const toggleButton = page.getByRole('button', { name: /show password/i });

  await expect(passwordInput).toHaveAttribute('type', 'password');
  await toggleButton.click();
  await expect(passwordInput).toHaveAttribute('type', 'text');
});
```

#### 4. Navigation Tests

- Test link navigation
- Test redirect behavior after actions
- Test URL changes

```typescript
test('should navigate to forgot password page', async ({ page }) => {
  await page.getByRole('link', { name: /forgot password/i }).click();
  await expect(page).toHaveURL('/forgot-password');
});
```

#### 5. Accessibility Tests

- Verify ARIA labels and roles
- Test keyboard navigation (Tab order)
- Test screen reader compatibility

```typescript
test('should be keyboard navigable', async ({ page }) => {
  await page.getByLabel('Email Address').focus();
  await expect(page.getByLabel('Email Address')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#password')).toBeFocused();
});

test('should have proper aria labels', async ({ page }) => {
  const emailInput = page.getByLabel('Email Address');
  await expect(emailInput).toHaveAttribute('type', 'email');
  await expect(emailInput).toHaveAttribute('autocomplete', 'email');
});
```

#### 6. Loading/Error States

- Test loading indicators
- Test error message display
- Test disabled states during submission

```typescript
test('should display error alerts with proper role', async ({ page }) => {
  await page.getByLabel('Email Address').fill('test@example.com');
  await page.locator('#password').fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign In' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible({ timeout: 10000 });
});
```

### Playwright Best Practices

```typescript
// ✅ DO: Use semantic locators
page.getByRole('button', { name: 'Submit' });
page.getByLabel('Email Address');
page.getByRole('heading', { name: 'Welcome' });
page.getByText('Error message');

// ❌ DON'T: Use brittle CSS selectors
page.locator('.btn-primary');
page.locator('#submit-btn');
page.locator('div > span.error');

// ✅ DO: Use specific assertions with timeouts
await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
await expect(page).toHaveURL('/dashboard');

// ✅ DO: Group tests with describe blocks
test.describe('Login Form', () => {
  test.describe('Validation', () => {
    /* tests */
  });
  test.describe('Success Flow', () => {
    /* tests */
  });
  test.describe('Error Handling', () => {
    /* tests */
  });
});

// ✅ DO: Use beforeEach for common setup
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
});
```

---

## Integration Test Structure

### File Setup Template

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { getORM } from '../../lib/db';
import { makeRequest, waitForDatabase } from './helpers';

describe('[Feature] Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
  });

  afterEach(async () => {
    // Clean up test data after each test
    const orm = getORM();
    const em = orm.em.fork();
    await em.nativeDelete('table_name', {});
  });

  describe('[HTTP Method] /api/endpoint', () => {
    it('should return [status] for [scenario]', async () => {
      const response = await makeRequest().post('/api/endpoint').send({
        /* request body */
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        /* expected shape */
      });
    });
  });
});
```

### What to Include in Integration Tests

#### 1. Validation Tests

Test that invalid requests are properly rejected:

```typescript
it('should return 400 for invalid email format', async () => {
  const response = await makeRequest()
    .post('/api/auth/login')
    .send({ email: 'invalid-email', password: 'password123' });

  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Validation error');
});

it('should return 400 for missing required fields', async () => {
  const response = await makeRequest()
    .post('/api/auth/login')
    .send({ email: 'test@example.com' }); // missing password

  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Validation error');
});
```

#### 2. Authentication Tests

Test that protected routes require authentication:

```typescript
it('should return 401 when not authenticated', async () => {
  const response = await makeRequest().get('/api/auth/me');

  expect(response.status).toBe(401);
  expect(response.body.error).toBe('Not authenticated');
});

it('should return 403 when lacking permission', async () => {
  const response = await makeRequest()
    .get('/api/admin/users')
    .set('Cookie', userSessionCookie); // non-admin user

  expect(response.status).toBe(403);
  expect(response.body.error).toBe('Forbidden');
});
```

#### 3. Success Scenarios

Test that valid requests produce expected results:

```typescript
it('should return 200 for valid request', async () => {
  const response = await makeRequest().post('/api/auth/login').send({
    email: 'test@example.com',
    password: 'ValidPassword123!',
  });

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    user: { email: 'test@example.com' },
  });
});
```

#### 4. Error Scenarios

Test error handling for various failure cases:

```typescript
it('should return 401 for invalid credentials', async () => {
  const response = await makeRequest().post('/api/auth/login').send({
    email: 'nonexistent@example.com',
    password: 'password123',
  });

  expect(response.status).toBe(401);
  expect(response.body.error).toBe('Invalid credentials');
});

it('should return 404 for non-existent resource', async () => {
  const response = await makeRequest().get('/api/users/non-existent-id');

  expect(response.status).toBe(404);
});
```

#### 5. Edge Cases

Test boundary conditions and special scenarios:

```typescript
it('should handle concurrent requests properly', async () => {
  const requests = Array(5)
    .fill(null)
    .map(() => makeRequest().post('/api/resource').send({ data: 'test' }));

  const responses = await Promise.all(requests);
  responses.forEach(r => expect(r.status).toBe(201));
});
```

### Integration Test Best Practices

```typescript
// ✅ DO: Always clean up test data
afterEach(async () => {
  const orm = getORM();
  const em = orm.em.fork();
  await em.nativeDelete('user', {});
  await em.nativeDelete('session', {});
});

// ✅ DO: Use makeRequest helper for consistency
const response = await makeRequest()
  .post('/api/endpoint')
  .send({ data: 'value' });

// ✅ DO: Test response structure with toMatchObject
expect(response.body).toMatchObject({
  id: expect.any(String),
  email: 'test@example.com',
  createdAt: expect.any(String),
});

// ✅ DO: Wait for database before tests
beforeAll(async () => {
  await waitForDatabase();
});

// ✅ DO: Group by endpoint
describe('POST /api/auth/login', () => {
  /* tests */
});
describe('GET /api/auth/me', () => {
  /* tests */
});
```

---

## Unit Test Structure

### File Setup Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('[Function/Module Name]', () => {
  describe('[specific function]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      const input = /* test input */;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(/* expected */);
    });
  });
});
```

### What to Include in Unit Tests

#### 1. Happy Path Tests

Test normal expected behavior:

```typescript
it('should return true for valid permission', () => {
  expect(isValidPermission('customer:read')).toBe(true);
  expect(isValidPermission('user:create')).toBe(true);
});

it('should match identical permissions', () => {
  expect(matchPermission('customer:read', 'customer:read')).toBe(true);
});
```

#### 2. Edge Cases

Test boundary conditions:

```typescript
it('should return false for empty input', () => {
  expect(isValidPermission('')).toBe(false);
});

it('should handle empty permission array', () => {
  expect(hasPermission('customer:read', [])).toBe(false);
});

it('should return empty array for invalid patterns', () => {
  expect(expandWildcard('invalid:pattern')).toEqual([]);
});
```

#### 3. Error Cases

Test error handling:

```typescript
it('should throw for null input', () => {
  expect(() => processData(null)).toThrow('Input cannot be null');
});

it('should return false for malformed data', () => {
  expect(validateInput({ invalid: 'structure' })).toBe(false);
});
```

#### 4. Complex Logic Tests

Test business logic thoroughly:

```typescript
describe('wildcard matching', () => {
  it('should match any permission with *', () => {
    expect(matchPermission('customer:read', '*')).toBe(true);
    expect(matchPermission('user:delete', '*')).toBe(true);
  });

  it('should match resource wildcard (resource:*)', () => {
    expect(matchPermission('customer:read', 'customer:*')).toBe(true);
    expect(matchPermission('customer:create', 'customer:*')).toBe(true);
    expect(matchPermission('user:read', 'customer:*')).toBe(false);
  });
});
```

### Unit Test Best Practices

```typescript
// ✅ DO: Test one thing per test
it('should return true for valid permission', () => {
  expect(isValidPermission('customer:read')).toBe(true);
});

it('should return false for invalid permission', () => {
  expect(isValidPermission('invalid:perm')).toBe(false);
});

// ✅ DO: Use descriptive test names
it('should expand resource:* to all actions for that resource', () => {
  const expanded = expandWildcard('customer:*');
  expect(expanded).toContain('customer:read');
  expect(expanded).toContain('customer:create');
});

// ✅ DO: Mock dependencies properly
vi.mock('../../lib/db', () => ({
  getORM: vi.fn(() => ({ em: { fork: vi.fn() } })),
}));

// ✅ DO: Group related tests with describe
describe('hasPermission', () => {
  describe('exact match', () => {
    /* tests */
  });
  describe('wildcard match', () => {
    /* tests */
  });
  describe('edge cases', () => {
    /* tests */
  });
});

// ✅ DO: Follow AAA pattern
it('should calculate total correctly', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(30);
});
```

---

## General Testing Requirements

### Mandatory Coverage

- **80% minimum** for branches, functions, lines, and statements
- **All new code** must include tests - no exceptions
- **Error scenarios** and edge cases must be tested

### Test Structure (AAA Pattern)

1. **Arrange**: Set up test data and conditions
2. **Act**: Execute the code under test
3. **Assert**: Verify the expected outcome

### Naming Conventions

- **Test names**: `should [expected behavior] when [condition]`
- **E2E files**: `*.spec.ts`
- **Unit/Integration files**: `*.test.ts`
- **Test folders**: `__tests__` close to source

---

## Testing Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter api test
pnpm --filter web test

# Run Playwright E2E tests
pnpm --filter web e2e

# Run Playwright with UI
pnpm --filter web e2e --ui
```

---

## Checklist Before Completing Tests

- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] One assertion focus per test (test one behavior)
- [ ] Descriptive test names that explain what's being tested
- [ ] Happy path is covered
- [ ] Error scenarios are covered
- [ ] Edge cases are covered (empty, null, boundary values)
- [ ] Proper cleanup in afterEach/afterAll hooks
- [ ] No hardcoded waits (use proper async patterns)
- [ ] No test interdependencies (tests can run in isolation)
- [ ] Tests pass individually and together
- [ ] Linting passes on all test files
- [ ] Coverage meets 80% minimum threshold

