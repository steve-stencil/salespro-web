/**
 * Application router configuration.
 * Defines all routes and their components.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { MfaVerifyPage } from './pages/MfaVerifyPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

/**
 * Application routes configuration.
 *
 * Public routes:
 * - /login - Login page
 * - /mfa-verify - MFA verification (after login)
 * - /forgot-password - Request password reset
 * - /reset-password - Reset password with token
 *
 * Protected routes:
 * - /dashboard - Main dashboard (requires authentication)
 * - / - Redirects to /dashboard
 */
export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/mfa-verify',
    element: <MfaVerifyPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },

  // Protected routes
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },

  // Root redirect
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // Catch-all redirect to dashboard
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
