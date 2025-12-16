/**
 * Application router configuration.
 * Defines all routes and their components.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { PermissionGuard } from './components/PermissionGuard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PERMISSIONS } from './hooks/usePermissions';
import { AppLayout } from './layouts/AppLayout';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { MfaVerifyPage } from './pages/MfaVerifyPage';
import { OfficesPage } from './pages/OfficesPage';
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
 * - /accept-invite - Accept invitation and create account
 *
 * Protected routes (with sidebar):
 * - /dashboard - Main dashboard
 * - /users - User management
 * - /roles - Role management
 * - /offices - Office management
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
  {
    path: '/accept-invite',
    element: <AcceptInvitePage />,
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
        element: (
          <PermissionGuard permission={PERMISSIONS.USER_READ}>
            <UsersPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/roles',
        element: (
          <PermissionGuard permission={PERMISSIONS.ROLE_READ}>
            <RolesPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/offices',
        element: (
          <PermissionGuard permission={PERMISSIONS.OFFICE_READ}>
            <OfficesPage />
          </PermissionGuard>
        ),
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
