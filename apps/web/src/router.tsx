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
import { CompanySettingsPage } from './pages/CompanySettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataMigrationPage } from './pages/DataMigrationPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { InternalUsersPage } from './pages/InternalUsersPage';
import { LoginPage } from './pages/LoginPage';
import { MfaVerifyPage } from './pages/MfaVerifyPage';
import { OfficesPage } from './pages/OfficesPage';
import { PlatformCompaniesPage } from './pages/PlatformCompaniesPage';
import { PlatformRolesPage } from './pages/PlatformRolesPage';
import {
  CatalogPage,
  CategoryManagementPage,
  LibraryPage,
} from './pages/price-guide';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RolesPage } from './pages/RolesPage';
import { SelectCompanyPage } from './pages/SelectCompanyPage';
import { UsersPage } from './pages/UsersPage';

/**
 * Application routes configuration.
 *
 * Public routes:
 * - /login - Login page
 * - /mfa-verify - MFA verification (after login)
 * - /select-company - Company selection (for multi-company users after login)
 * - /forgot-password - Request password reset
 * - /reset-password - Reset password with token
 * - /accept-invite - Accept invitation and create account
 *
 * Protected routes (with sidebar):
 * - /dashboard - Main dashboard
 * - /users - User management
 * - /roles - Role management
 * - /offices - Office management
 * - /admin/settings - Company settings (admin)
 * - /platform/internal-users - Platform internal user management
 * - /platform/roles - Platform role management
 * - /platform/companies - Platform company management
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
    path: '/select-company',
    element: <SelectCompanyPage />,
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
      {
        path: '/admin/settings',
        element: (
          <PermissionGuard permission={PERMISSIONS.COMPANY_UPDATE}>
            <CompanySettingsPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/admin/data-migration',
        element: (
          <PermissionGuard permission={PERMISSIONS.DATA_MIGRATION}>
            <DataMigrationPage />
          </PermissionGuard>
        ),
      },
      // Price Guide routes
      {
        path: '/price-guide',
        element: (
          <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_READ}>
            <CatalogPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/price-guide/library',
        element: (
          <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_READ}>
            <LibraryPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/price-guide/categories',
        element: (
          <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_READ}>
            <CategoryManagementPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/platform/internal-users',
        element: (
          <PermissionGuard
            permission={PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS}
          >
            <InternalUsersPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/platform/roles',
        element: (
          <PermissionGuard permission={PERMISSIONS.PLATFORM_ADMIN}>
            <PlatformRolesPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/platform/companies',
        element: (
          <PermissionGuard permission={PERMISSIONS.PLATFORM_VIEW_COMPANIES}>
            <PlatformCompaniesPage />
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
