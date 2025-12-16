/**
 * Application router configuration.
 * Defines all routes and their components.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { MfaVerifyPage } from './pages/MfaVerifyPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RolesPage } from './pages/RolesPage';
import { UsersPage } from './pages/UsersPage';

/**
 * Application routes configuration.
 *
 * Public routes:
 * - /login - Login page
 * - /mfa-verify - MFA verification (after login)
 * - /forgot-password - Request password reset
 * - /reset-password - Reset password with token
 *
 * Protected routes (with sidebar):
 * - /dashboard - Main dashboard
 * - /users - User management
 * - /roles - Role management
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

  // Protected routes with AppLayout
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/users',
        element: <UsersPage />,
      },
      {
        path: '/roles',
        element: <RolesPage />,
      },
    ],
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
