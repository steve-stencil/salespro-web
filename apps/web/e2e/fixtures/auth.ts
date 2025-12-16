/**
 * Authentication fixtures for Playwright E2E tests.
 * Provides helpers for logging in users via UI (more reliable for E2E tests).
 */
import { test as base, expect } from '@playwright/test';

/**
 * Login via UI and wait for successful authentication.
 * This is more reliable for E2E tests as it tests the full user flow.
 */
async function loginViaUI(
  page: Awaited<ReturnType<typeof base['newPage']>>,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');

  // Wait for login form to be ready
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });

  // Fill in login form
  await page.getByLabel('Email Address').fill(email);
  await page.locator('#password').fill(password);

  // Submit form and wait for navigation
  const navigationPromise = page.waitForNavigation({ timeout: 15000 });
  await page.getByRole('button', { name: 'Sign In' }).click();

  try {
    await navigationPromise;
  } catch (error) {
    // Check if there's an error message on the page
    const alert = page.locator('[role="alert"]');
    if (await alert.isVisible().catch(() => false)) {
      const errorText = await alert.textContent();
      throw new Error(`Login failed: ${errorText}`);
    }
    throw error;
  }

  // Check current URL
  const currentUrl = page.url();

  // Handle MFA if required
  if (currentUrl.includes('/mfa-verify')) {
    throw new Error('MFA required - test user should not have MFA enabled');
  }

  // Verify we're on dashboard (or allow other authenticated pages)
  if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/roles') && !currentUrl.includes('/users')) {
    // Check if we're still on login (login failed)
    if (currentUrl.includes('/login')) {
      const alert = page.locator('[role="alert"]');
      if (await alert.isVisible().catch(() => false)) {
        const errorText = await alert.textContent();
        throw new Error(`Login failed: ${errorText}`);
      }
      throw new Error('Login failed - still on login page');
    }
  }
}

/**
 * Extended test context with authentication helpers.
 */
type AuthFixtures = {
  authenticatedPage: Awaited<ReturnType<typeof base['newPage']>>;
  adminPage: Awaited<ReturnType<typeof base['newPage']>>;
  loginAsUser: (email: string, password: string) => Promise<void>;
};

/**
 * Test fixtures that provide authenticated pages.
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Page with a logged-in user (uses default test user).
   */
  authenticatedPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await loginViaUI(
      page,
      process.env['TEST_USER_EMAIL'] ?? 'admin@leaptodigital.com',
      process.env['TEST_USER_PASSWORD'] ?? 'Admin123!',
    );

    await use(page);
    await page.close();
  },

  /**
   * Page with an admin user logged in.
   */
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await loginViaUI(
      page,
      process.env['TEST_ADMIN_EMAIL'] ?? 'admin@leaptodigital.com',
      process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin123!',
    );

    await use(page);
    await page.close();
  },

  /**
   * Helper function to log in as a specific user.
   */
  loginAsUser: async ({ page }, use) => {
    await use(async (email: string, password: string) => {
      await loginViaUI(page, email, password);
    });
  },
});

export { expect };

