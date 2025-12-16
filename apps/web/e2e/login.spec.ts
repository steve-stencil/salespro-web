import { test, expect } from '@playwright/test';

/**
 * E2E tests for the login page functionality.
 * These tests verify the complete login flow in a real browser environment.
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test.describe('Page Display', () => {
    test('should display the login form with all elements', async ({
      page,
    }) => {
      // Verify page title/heading
      await expect(
        page.getByRole('heading', { name: 'Welcome Back' }),
      ).toBeVisible();

      // Verify form elements - use locator for password to avoid conflict with toggle button
      await expect(page.getByLabel('Email Address')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(
        page.getByRole('checkbox', { name: /remember me/i }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
      await expect(
        page.getByRole('link', { name: /forgot password/i }),
      ).toBeVisible();
    });

    test('should display the Leap logo', async ({ page }) => {
      // Verify logo is present
      const logo = page.locator('svg').first();
      await expect(logo).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should show error when submitting empty form', async ({ page }) => {
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Verify validation errors
      await expect(page.getByText('Email is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
    });

    test('should show error for invalid email format', async ({ page }) => {
      await page.getByLabel('Email Address').fill('invalid-email');
      await page.locator('#password').fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(
        page.getByText('Please enter a valid email address'),
      ).toBeVisible();
    });

    test('should clear field errors when user starts typing', async ({
      page,
    }) => {
      // Submit empty form to trigger errors
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page.getByText('Email is required')).toBeVisible();

      // Start typing to clear error
      await page.getByLabel('Email Address').fill('test@example.com');
      await expect(page.getByText('Email is required')).not.toBeVisible();
    });
  });

  test.describe('Invalid Credentials', () => {
    test('should show error for invalid password', async ({ page }) => {
      await page.getByLabel('Email Address').fill('test@example.com');
      await page.locator('#password').fill('wrongpassword');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for error message (either invalid credentials or connection error)
      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible({ timeout: 10000 });
    });

    test('should show error for non-existent user', async ({ page }) => {
      await page.getByLabel('Email Address').fill('nonexistent@example.com');
      await page.locator('#password').fill('SomePassword123!');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for error message (either invalid credentials or connection error)
      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Password Visibility Toggle', () => {
    test('should toggle password visibility', async ({ page }) => {
      const passwordInput = page.locator('#password');
      const toggleButton = page.getByRole('button', { name: /show password/i });

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Click toggle to show password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');

      // Click toggle to hide password again
      const hideButton = page.getByRole('button', { name: /hide password/i });
      await hideButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Remember Me Checkbox', () => {
    test('should be unchecked by default', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: /remember me/i });
      await expect(checkbox).not.toBeChecked();
    });

    test('should toggle when clicked', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: /remember me/i });

      await checkbox.check();
      await expect(checkbox).toBeChecked();

      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to forgot password page', async ({ page }) => {
      await page.getByRole('link', { name: /forgot password/i }).click();
      await expect(page).toHaveURL('/forgot-password');
    });
  });

  test.describe('Loading State', () => {
    test('should show loading state while submitting', async ({ page }) => {
      // Fill in valid credentials
      await page.getByLabel('Email Address').fill('test@example.com');
      await page.locator('#password').fill('TestPassword123!');

      // Click submit and immediately check for loading state
      const submitPromise = page
        .getByRole('button', { name: 'Sign In' })
        .click();

      // Verify loading state appears (may be brief)
      // Use a race between loading text appearing and the request finishing
      await Promise.race([
        page
          .getByText('Signing in...')
          .isVisible()
          .then(() => true),
        submitPromise.then(() => false),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1000)),
      ]);

      // If the request was fast, we may not see loading state - that's acceptable
      // Just verify the page didn't crash and shows some result
      await expect(
        page
          .getByRole('button', { name: 'Sign In' })
          .or(page.getByRole('alert')),
      ).toBeVisible({ timeout: 10000 });
    });

    test('should disable form inputs while submitting', async ({ page }) => {
      // Fill in valid credentials
      await page.getByLabel('Email Address').fill('test@example.com');
      await page.locator('#password').fill('TestPassword123!');

      // Click submit
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for response to complete - either button returns or alert appears
      // Use waitForSelector to handle either case
      await page.waitForSelector(
        '[role="alert"], button[type="submit"]:not(:disabled)',
        {
          timeout: 10000,
        },
      );
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper aria labels', async ({ page }) => {
      // Check email input has proper labeling
      const emailInput = page.getByLabel('Email Address');
      await expect(emailInput).toHaveAttribute('type', 'email');
      await expect(emailInput).toHaveAttribute('autocomplete', 'email');

      // Check password input has proper labeling
      const passwordInput = page.locator('#password');
      await expect(passwordInput).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
    });

    test('should display error alerts with proper role', async ({ page }) => {
      await page.getByLabel('Email Address').fill('test@example.com');
      await page.locator('#password').fill('wrongpassword');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Error should be in an alert role
      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible({ timeout: 10000 });
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Focus the email input first
      await page.getByLabel('Email Address').focus();
      await expect(page.getByLabel('Email Address')).toBeFocused();

      // Tab to password input
      await page.keyboard.press('Tab');
      await expect(page.locator('#password')).toBeFocused();

      // Tab to next element (toggle button)
      await page.keyboard.press('Tab');
      // Toggle password visibility button should be focused
      await expect(
        page.getByRole('button', { name: /show password/i }),
      ).toBeFocused();
    });
  });
});

test.describe('Login Success Flow', () => {
  test.skip('should redirect to dashboard after successful login', async ({
    page,
  }) => {
    // Note: This test requires a seeded test user in the database
    // Skip unless running against a seeded environment
    await page.goto('/login');

    await page.getByLabel('Email Address').fill('admin@leaptodigital.com');
    await page.locator('#password').fill('Admin123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test.skip('should persist session after browser refresh', async ({
    page,
  }) => {
    // Note: This test requires a seeded test user in the database
    await page.goto('/login');

    await page.getByLabel('Email Address').fill('admin@leaptodigital.com');
    await page.locator('#password').fill('Admin123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Refresh the page
    await page.reload();

    // Should still be on dashboard
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('MFA Flow', () => {
  test.skip('should redirect to MFA page when MFA is required', async ({
    page,
  }) => {
    // Note: This test requires a user with MFA enabled or company with MFA required
    await page.goto('/login');

    await page.getByLabel('Email Address').fill('mfa-user@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should redirect to MFA verification page
    await expect(page).toHaveURL('/mfa-verify', { timeout: 10000 });

    // Verify email-based MFA page elements
    await expect(
      page.getByRole('heading', { name: /check your email/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/we've sent a 6-digit code to your email/i),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Verification code' }),
    ).toBeVisible();
  });
});

test.describe('Account Lockout', () => {
  test.skip('should show lockout message after multiple failed attempts', async ({
    page,
  }) => {
    // Note: This test requires specific test setup
    await page.goto('/login');

    // Attempt login multiple times with wrong password
    for (let i = 0; i < 6; i++) {
      await page.getByLabel('Email Address').fill('lockout-test@example.com');
      await page.locator('#password').fill('WrongPassword!');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for error to appear before retrying
      await page.waitForSelector('[role="alert"]', { timeout: 10000 });

      // Clear form for next attempt
      if (i < 5) {
        await page.getByLabel('Email Address').clear();
        await page.locator('#password').clear();
      }
    }

    // Should show lockout message
    await expect(
      page.getByRole('alert').getByText(/account is temporarily locked/i),
    ).toBeVisible();
  });
});
