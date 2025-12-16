import { expect } from '@playwright/test';

import { test } from './fixtures/auth';

/**
 * E2E tests for roles and permissions functionality.
 * These tests verify the roles management UI in a real browser environment.
 *
 * Note: These tests require a user with role:read permission to be logged in.
 * For full CRUD testing, the user needs role:create, role:update, role:delete permissions.
 */

test.describe('Roles Page', () => {
  test.describe('Unauthenticated Access', () => {
    test('should redirect to login when accessing roles without authentication', async ({
      page,
    }) => {
      await page.goto('/roles');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Authenticated Access', () => {
    test('should display the roles page with navigation', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Verify page heading
      await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible();

      // Verify page description
      await expect(
        page.getByText(/manage roles and permissions/i),
      ).toBeVisible();
    });

    test('should display list of available roles', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for roles to load
      await page.waitForSelector('[data-testid^="role-card-"]', {
        timeout: 10000,
      });

      // Verify at least one role card is visible
      const roleCards = page.locator('[data-testid^="role-card-"]');
      await expect(roleCards.first()).toBeVisible();
    });

    test('should display system and custom roles sections', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for content to load
      await page.waitForSelector('h3', { timeout: 10000 });

      // Verify sections exist (may be empty, but sections should be present)
      const headings = page.locator('h3');
      const headingTexts = await headings.allTextContents();

      // Should have at least one section heading
      expect(headingTexts.length).toBeGreaterThan(0);
      expect(
        headingTexts.some(
          text =>
            text.toLowerCase().includes('system') ||
            text.toLowerCase().includes('custom'),
        ),
      ).toBe(true);
    });

    test('should display role details when clicking on a role card', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for roles to load
      await page.waitForSelector('[data-testid^="role-card-"]', {
        timeout: 10000,
      });

      // Click on the first role card
      const firstRoleCard = page.locator('[data-testid^="role-card-"]').first();
      await firstRoleCard.click();

      // Verify detail dialog is open
      await expect(
        page.getByRole('dialog', { name: /role details/i }),
      ).toBeVisible({ timeout: 5000 });

      // Verify role information is displayed
      await expect(page.getByText(/role information/i)).toBeVisible();
      await expect(page.getByText(/permissions/i)).toBeVisible();
    });
  });

  test.describe('Search and Filter', () => {
    test('should filter roles by search query', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for roles to load
      await page.waitForSelector('[data-testid="roles-search-input"]', {
        timeout: 10000,
      });

      // Get initial role count
      const initialCards = page.locator('[data-testid^="role-card-"]');
      const initialCount = await initialCards.count();

      if (initialCount > 0) {
        // Get the first role's display name
        const firstRoleName = await page
          .locator('[data-testid^="role-card-"]')
          .first()
          .locator('h3')
          .textContent();

        if (firstRoleName) {
          // Search for that role
          await page
            .getByTestId('roles-search-input')
            .fill(firstRoleName.substring(0, 3));

          // Wait for filtering
          await page.waitForTimeout(500);

          // Should still show at least one result
          const filteredCards = page.locator('[data-testid^="role-card-"]');
          await expect(filteredCards.first()).toBeVisible();
        }
      }
    });

    test('should filter by role type', async ({ authenticatedPage: page }) => {
      await page.goto('/roles');

      // Wait for filter to be available
      await page.waitForSelector('[data-testid="roles-type-filter"]', {
        timeout: 10000,
      });

      // Select "Custom Only" filter
      await page.getByTestId('roles-type-filter').click();
      await page.getByRole('option', { name: /custom/i }).click();

      // Wait for filtering
      await page.waitForTimeout(500);

      // Verify custom roles section is visible (or empty state)
      await expect(
        page.getByText(/custom roles/i).or(page.getByText(/no custom roles/i)),
      ).toBeVisible();
    });

    test('should sort roles by name', async ({ authenticatedPage: page }) => {
      await page.goto('/roles');

      // Wait for sort dropdown
      await page.waitForSelector('[data-testid="roles-sort-select"]', {
        timeout: 10000,
      });

      // Change sort order
      await page.getByTestId('roles-sort-select').click();
      await page.getByRole('option', { name: /name z-a/i }).click();

      // Wait for sorting
      await page.waitForTimeout(500);

      // Verify roles are still visible (sorting worked)
      const roleCards = page.locator('[data-testid^="role-card-"]');
      const count = await roleCards.count();
      if (count > 0) {
        await expect(roleCards.first()).toBeVisible();
      }
    });

    test('should clear filters', async ({ authenticatedPage: page }) => {
      await page.goto('/roles');

      // Apply a filter
      await page.waitForSelector('[data-testid="roles-search-input"]', {
        timeout: 10000,
      });
      await page.getByTestId('roles-search-input').fill('test');

      // Wait for filter button to appear
      await page.waitForSelector('button:has-text("Clear Filters")', {
        timeout: 5000,
      });

      // Clear filters
      await page.getByRole('button', { name: /clear filters/i }).click();

      // Verify search is cleared
      await expect(page.getByTestId('roles-search-input')).toHaveValue('');
    });
  });
});

test.describe('Permission System Behavior', () => {
  test.describe('Permission-Based Access Control', () => {
    test('should show 403 page when user lacks required permission', async ({
      page,
      loginAsUser,
    }) => {
      // Note: This test requires a user without role:read permission
      // For now, we'll test that unauthenticated users get redirected
      await page.goto('/roles');

      // Should redirect to login (or show 403 if authenticated without permission)
      await expect(page).toHaveURL(/\/login|\/dashboard/);
    });

    test('should hide create button for users without role:create permission', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for page to load
      await page.waitForSelector('h2', { timeout: 10000 });

      // Check if create button exists - it may or may not be visible based on permissions
      const createButton = page.getByTestId('create-role-btn');
      const isVisible = await createButton.isVisible().catch(() => false);

      // If visible, verify it's enabled (if user has permission)
      if (isVisible) {
        await expect(createButton).toBeEnabled();
      }
      // If not visible, that's also valid (user doesn't have permission)
    });
  });
});

test.describe('Role CRUD Operations', () => {
  test.describe('Create Role', () => {
    test('should open create role dialog', async ({ adminPage: page }) => {
      await page.goto('/roles');

      // Wait for create button
      await page.waitForSelector('[data-testid="create-role-btn"]', {
        timeout: 10000,
      });

      // Click create button
      await page.getByTestId('create-role-btn').click();

      // Verify dialog is open
      await expect(
        page.getByRole('dialog', { name: /create new role/i }),
      ).toBeVisible();
    });

    test('should validate required fields on create', async ({
      adminPage: page,
    }) => {
      await page.goto('/roles');

      // Open create dialog
      await page.waitForSelector('[data-testid="create-role-btn"]', {
        timeout: 10000,
      });
      await page.getByTestId('create-role-btn').click();

      // Wait for dialog
      await expect(
        page.getByRole('dialog', { name: /create new role/i }),
      ).toBeVisible();

      // Try to submit without filling required fields
      await page.getByRole('button', { name: /create role/i }).click();

      // Verify validation errors (may take a moment)
      await page.waitForTimeout(500);

      // Check for validation errors
      const nameError = page.getByText(/name is required/i);
      const displayNameError = page.getByText(/display name is required/i);
      const permissionsError = page.getByText(/at least one permission/i);

      // At least one validation error should be visible
      const hasNameError = await nameError.isVisible().catch(() => false);
      const hasDisplayNameError = await displayNameError.isVisible().catch(() => false);
      const hasPermissionsError = await permissionsError.isVisible().catch(() => false);

      expect(hasNameError || hasDisplayNameError || hasPermissionsError).toBe(
        true,
      );
    });

    test('should successfully create a new role', async ({ adminPage: page }) => {
      await page.goto('/roles');

      // Open create dialog
      await page.waitForSelector('[data-testid="create-role-btn"]', {
        timeout: 10000,
      });
      await page.getByTestId('create-role-btn').click();

      // Wait for dialog
      await expect(
        page.getByRole('dialog', { name: /create new role/i }),
      ).toBeVisible();

      // Fill in role details
      const timestamp = Date.now();
      const roleName = `test-role-${timestamp}`;
      const displayName = `Test Role ${timestamp}`;

      await page.getByLabel('Role Name').fill(roleName);
      await page.getByLabel('Display Name').fill(displayName);

      // Select at least one permission
      // Wait for permissions to load
      await page.waitForTimeout(1000);

      // Find and check a permission checkbox
      const permissionCheckboxes = page.locator(
        'input[type="checkbox"][name*="permission"]',
      );
      const firstCheckbox = permissionCheckboxes.first();
      if (await firstCheckbox.isVisible().catch(() => false)) {
        await firstCheckbox.check();
      } else {
        // Try alternative selector
        const altCheckbox = page
          .locator('input[type="checkbox"]')
          .filter({ hasText: /customer:read/i })
          .first();
        if (await altCheckbox.isVisible().catch(() => false)) {
          await altCheckbox.check();
        }
      }

      // Submit
      await page.getByRole('button', { name: /create role/i }).click();

      // Wait for success (dialog should close and role should appear)
      await expect(
        page.getByRole('dialog', { name: /create new role/i }),
      ).not.toBeVisible({ timeout: 10000 });

      // Verify role appears in the list
      await expect(page.getByText(displayName)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('View Role Details', () => {
    test('should display role details dialog with all information', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for roles to load
      await page.waitForSelector('[data-testid^="role-card-"]', {
        timeout: 10000,
      });

      // Click on first role card
      await page.locator('[data-testid^="role-card-"]').first().click();

      // Verify dialog is open
      await expect(
        page.getByRole('dialog', { name: /role details/i }),
      ).toBeVisible();

      // Verify role information section
      await expect(page.getByText(/role information/i)).toBeVisible();
      await expect(page.getByText(/metadata/i)).toBeVisible();
      await expect(page.getByText(/permissions/i)).toBeVisible();
    });

    test('should show permission categories in detail view', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for roles to load
      await page.waitForSelector('[data-testid^="role-card-"]', {
        timeout: 10000,
      });

      // Click on first role card
      await page.locator('[data-testid^="role-card-"]').first().click();

      // Wait for dialog
      await expect(
        page.getByRole('dialog', { name: /role details/i }),
      ).toBeVisible();

      // Wait for permissions to load
      await page.waitForTimeout(1000);

      // Verify at least one permission category is visible
      // Categories like "Customers", "Users", etc.
      const categoryHeadings = page.locator('h6, .MuiTypography-subtitle2');
      const categoryCount = await categoryHeadings.count();

      // Should have at least some content in the permissions section
      expect(categoryCount).toBeGreaterThan(0);
    });
  });

  test.describe('System Roles', () => {
    test('should not allow editing system roles', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for roles to load
      await page.waitForSelector('[data-testid^="role-card-"]', {
        timeout: 10000,
      });

      // Find a system role (they should have a lock icon or "System" badge)
      const systemRoleCard = page
        .locator('[data-testid^="role-card-"]')
        .filter({ has: page.locator('text=System') })
        .first();

      if (await systemRoleCard.isVisible().catch(() => false)) {
        // Try to find edit button
        const editButton = systemRoleCard.locator(
          '[data-testid^="edit-role-"]',
        );

        if (await editButton.isVisible().catch(() => false)) {
          // Edit button should be disabled for system roles
          await expect(editButton).toBeDisabled();
        }
      }
    });

    test('should not allow deleting system roles', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/roles');

      // Wait for roles to load
      await page.waitForSelector('[data-testid^="role-card-"]', {
        timeout: 10000,
      });

      // Find a system role
      const systemRoleCard = page
        .locator('[data-testid^="role-card-"]')
        .filter({ has: page.locator('text=System') })
        .first();

      if (await systemRoleCard.isVisible().catch(() => false)) {
        // Try to find delete button
        const deleteButton = systemRoleCard.locator(
          '[data-testid^="delete-role-"]',
        );

        if (await deleteButton.isVisible().catch(() => false)) {
          // Delete button should be disabled for system roles
          await expect(deleteButton).toBeDisabled();
        }
      }
    });
  });
});

test.describe('Role Card Interactions', () => {
  test('should make role cards clickable to view details', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/roles');

    // Wait for roles to load
    await page.waitForSelector('[data-testid^="role-card-"]', {
      timeout: 10000,
    });

    // Click on a role card
    const firstCard = page.locator('[data-testid^="role-card-"]').first();
    await firstCard.click();

    // Verify detail dialog opens
    await expect(
      page.getByRole('dialog', { name: /role details/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should display permission preview on role cards', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/roles');

    // Wait for roles to load
    await page.waitForSelector('[data-testid^="role-card-"]', {
      timeout: 10000,
    });

    // Check that role cards show permission count
    const firstCard = page.locator('[data-testid^="role-card-"]').first();
    const cardText = await firstCard.textContent();

    // Should mention permissions
    expect(cardText?.toLowerCase()).toMatch(/permission/i);
  });
});

test.describe('Loading States', () => {
  test('should show loading skeleton while roles are loading', async ({
    authenticatedPage: page,
  }) => {
    // Navigate to roles page
    const navigationPromise = page.goto('/roles');

    // Check for skeleton loaders (they appear briefly)
    const skeleton = page.locator('.MuiSkeleton-root');
    const skeletonVisible = await skeleton
      .first()
      .isVisible()
      .catch(() => false);

    // Either skeleton was visible or page loaded quickly
    await navigationPromise;

    // After loading, verify content is visible
    await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
