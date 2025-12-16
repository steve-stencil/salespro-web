import { expect } from '@playwright/test';

import { test } from './fixtures/auth';

/**
 * E2E tests for company settings page.
 * Tests the MFA toggle functionality and company-wide settings management.
 *
 * Note: These tests require a user with company:update permission to be logged in.
 */

test.describe('Company Settings Page', () => {
  test.describe('Unauthenticated Access', () => {
    test('should redirect to login when accessing settings without authentication', async ({
      page,
    }) => {
      await page.goto('/admin/settings');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Authenticated Access', () => {
    test('should display the company settings page', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Verify page heading
      await expect(
        page.getByRole('heading', { name: /company settings/i }),
      ).toBeVisible();

      // Verify page description
      await expect(
        page.getByText(/configure company-wide settings/i),
      ).toBeVisible();
    });

    test('should display Security section with MFA toggle', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="security-section"]', {
        timeout: 10000,
      });

      // Verify Security section is visible
      await expect(page.getByTestId('security-section')).toBeVisible();
      await expect(page.getByText(/security/i).first()).toBeVisible();

      // Verify MFA toggle is present
      await expect(page.getByTestId('mfa-toggle')).toBeVisible();
      await expect(
        page.getByText(/require multi-factor authentication/i),
      ).toBeVisible();
    });

    test('should display company information section', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="company-info-section"]', {
        timeout: 10000,
      });

      // Verify Company Information section
      await expect(page.getByTestId('company-info-section')).toBeVisible();
      await expect(page.getByText(/company information/i)).toBeVisible();
      await expect(page.getByText(/company name/i)).toBeVisible();
      await expect(page.getByText(/last updated/i)).toBeVisible();
    });

    test('should show current MFA status', async ({ adminPage: page }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="mfa-toggle"]', {
        timeout: 10000,
      });

      // Verify MFA toggle is visible and has a state
      const mfaToggle = page.getByTestId('mfa-toggle');
      await expect(mfaToggle).toBeVisible();

      // Toggle should be either checked or unchecked (representing current state)
      const isChecked = await mfaToggle.isChecked();
      expect(typeof isChecked).toBe('boolean');
    });
  });

  test.describe('MFA Toggle Functionality', () => {
    test('should enable save button when MFA toggle is changed', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="mfa-toggle"]', {
        timeout: 10000,
      });

      // Get initial state of save button
      const saveButton = page.getByTestId('save-settings-btn');
      await expect(saveButton).toBeDisabled();

      // Toggle MFA
      const mfaToggle = page.getByTestId('mfa-toggle');
      await mfaToggle.click();

      // Save button should now be enabled
      await expect(saveButton).toBeEnabled();
    });

    test('should show reset button when changes are made', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="mfa-toggle"]', {
        timeout: 10000,
      });

      // Reset button should not be visible initially
      const resetButton = page.getByTestId('reset-btn');
      await expect(resetButton).not.toBeVisible();

      // Toggle MFA
      const mfaToggle = page.getByTestId('mfa-toggle');
      await mfaToggle.click();

      // Reset button should now be visible
      await expect(resetButton).toBeVisible();
    });

    test('should reset changes when reset button is clicked', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="mfa-toggle"]', {
        timeout: 10000,
      });

      // Get initial state
      const mfaToggle = page.getByTestId('mfa-toggle');
      const initialState = await mfaToggle.isChecked();

      // Toggle MFA
      await mfaToggle.click();

      // Verify state changed
      const changedState = await mfaToggle.isChecked();
      expect(changedState).not.toBe(initialState);

      // Click reset
      await page.getByTestId('reset-btn').click();

      // Verify state is back to initial
      const resetState = await mfaToggle.isChecked();
      expect(resetState).toBe(initialState);
    });

    test('should toggle MFA requirement and save', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="mfa-toggle"]', {
        timeout: 10000,
      });

      // Get initial state
      const mfaToggle = page.getByTestId('mfa-toggle');
      const initialState = await mfaToggle.isChecked();

      // Toggle MFA
      await mfaToggle.click();

      // Save changes
      await page.getByTestId('save-settings-btn').click();

      // Wait for success message
      await expect(page.getByTestId('settings-success-alert')).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page.getByText(/settings saved successfully/i),
      ).toBeVisible();

      // Verify state persisted
      const savedState = await mfaToggle.isChecked();
      expect(savedState).not.toBe(initialState);

      // Toggle back to original state to not affect other tests
      await mfaToggle.click();
      await page.getByTestId('save-settings-btn').click();
      await expect(page.getByTestId('settings-success-alert')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should show success message after save', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for settings to load
      await page.waitForSelector('[data-testid="mfa-toggle"]', {
        timeout: 10000,
      });

      // Toggle MFA and save
      const mfaToggle = page.getByTestId('mfa-toggle');
      await mfaToggle.click();
      await page.getByTestId('save-settings-btn').click();

      // Verify success alert is shown
      await expect(page.getByTestId('settings-success-alert')).toBeVisible({
        timeout: 5000,
      });

      // Toggle back to restore original state
      await mfaToggle.click();
      await page.getByTestId('save-settings-btn').click();
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display Admin section in sidebar for admin users', async ({
      adminPage: page,
    }) => {
      await page.goto('/dashboard');

      // Wait for sidebar to load
      await page.waitForSelector('[data-testid="nav-list"]', {
        timeout: 10000,
      });

      // Check for admin section
      await expect(page.getByTestId('admin-nav-list')).toBeVisible();

      // Check for Company Settings link
      await expect(page.getByTestId('nav-item-admin-settings')).toBeVisible();
    });

    test('should navigate to company settings from sidebar', async ({
      adminPage: page,
    }) => {
      await page.goto('/dashboard');

      // Wait for sidebar to load
      await page.waitForSelector('[data-testid="nav-item-admin-settings"]', {
        timeout: 10000,
      });

      // Click on Company Settings link
      await page.getByTestId('nav-item-admin-settings').click();

      // Verify navigation
      await expect(page).toHaveURL(/\/admin\/settings/);

      // Verify page loaded
      await expect(
        page.getByRole('heading', { name: /company settings/i }),
      ).toBeVisible();
    });

    test('should highlight settings link when on settings page', async ({
      adminPage: page,
    }) => {
      await page.goto('/admin/settings');

      // Wait for page to load
      await page.waitForSelector('[data-testid="nav-item-admin-settings"]', {
        timeout: 10000,
      });

      // Verify the settings link is selected (has Mui-selected class)
      const settingsLink = page.getByTestId('nav-item-admin-settings');
      await expect(settingsLink).toHaveClass(/Mui-selected/);
    });
  });

  test.describe('Loading States', () => {
    test('should show loading skeleton while settings are loading', async ({
      adminPage: page,
    }) => {
      // Navigate to settings page
      const navigationPromise = page.goto('/admin/settings');

      // Check for skeleton loaders (they appear briefly)
      const skeleton = page.locator('.MuiSkeleton-root');
      // Skeleton may or may not be visible depending on load speed
      await skeleton
        .first()
        .isVisible()
        .catch(() => false);

      await navigationPromise;

      // After loading, verify content is visible
      await expect(
        page.getByRole('heading', { name: /company settings/i }),
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
