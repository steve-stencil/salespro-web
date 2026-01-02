/**
 * Application router configuration.
 * Defines all routes and their components for the multi-app architecture.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { DashboardLayout } from './apps/dashboard/DashboardLayout';
import { SalesProHomePage } from './apps/salespro/pages';
import { SalesProLayout } from './apps/salespro/SalesProLayout';
import { AppProviderWrapper } from './components/AppProviderWrapper';
import { PermissionGuard } from './components/PermissionGuard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SmartRedirect } from './components/SmartRedirect';
import { PERMISSIONS } from './hooks/usePermissions';
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
  CreateWizard,
  LibraryPage,
  MigrationWizardPage,
  MsiEditPage,
  PricingPage,
  PriceTypesPage,
  TagManagementPage,
  ToolsPage,
} from './pages/price-guide';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RolesPage } from './pages/RolesPage';
import { SelectCompanyPage } from './pages/SelectCompanyPage';
import { UsersPage } from './pages/UsersPage';
import { AppGuard } from './shared/components/AppGuard';

/**
 * Application routes configuration.
 *
 * Multi-app architecture:
 * - /dashboard/* - Dashboard admin console (requires app:dashboard permission)
 * - /sales/* - SalesPro field sales app (requires app:salespro permission)
 *
 * Public routes:
 * - /login - Login page
 * - /mfa-verify - MFA verification (after login)
 * - /select-company - Company selection (for multi-company users after login)
 * - /forgot-password - Request password reset
 * - /reset-password - Reset password with token
 * - /accept-invite - Accept invitation and create account
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

  // ================================================================
  // Protected App Routes (with AppProvider)
  // ================================================================
  {
    element: (
      <ProtectedRoute>
        <AppProviderWrapper />
      </ProtectedRoute>
    ),
    children: [
      // ================================================================
      // DASHBOARD APP - Admin Console
      // ================================================================
      {
        path: '/dashboard',
        element: (
          <AppGuard app="dashboard">
            <DashboardLayout />
          </AppGuard>
        ),
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'users',
            element: (
              <PermissionGuard permission={PERMISSIONS.USER_READ}>
                <UsersPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'roles',
            element: (
              <PermissionGuard permission={PERMISSIONS.ROLE_READ}>
                <RolesPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'offices',
            element: (
              <PermissionGuard permission={PERMISSIONS.OFFICE_READ}>
                <OfficesPage />
              </PermissionGuard>
            ),
          },
          // Admin routes
          {
            path: 'admin/settings',
            element: (
              <PermissionGuard permission={PERMISSIONS.COMPANY_UPDATE}>
                <CompanySettingsPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'admin/data-migration',
            element: (
              <PermissionGuard permission={PERMISSIONS.DATA_MIGRATION}>
                <DataMigrationPage />
              </PermissionGuard>
            ),
          },
          // Price Guide routes
          {
            path: 'price-guide',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_READ}>
                <CatalogPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/library',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_READ}>
                <LibraryPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/categories',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_READ}>
                <CategoryManagementPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/create',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_CREATE}>
                <CreateWizard />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/:msiId/pricing',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_UPDATE}>
                <PricingPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/tools',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_UPDATE}>
                <ToolsPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/tags',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_UPDATE}>
                <TagManagementPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/price-types',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_UPDATE}>
                <PriceTypesPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/migration',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_CREATE}>
                <MigrationWizardPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'price-guide/:msiId',
            element: (
              <PermissionGuard permission={PERMISSIONS.PRICE_GUIDE_UPDATE}>
                <MsiEditPage />
              </PermissionGuard>
            ),
          },
          // Platform routes (internal users only)
          {
            path: 'platform/internal-users',
            element: (
              <PermissionGuard
                permission={PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS}
              >
                <InternalUsersPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'platform/roles',
            element: (
              <PermissionGuard permission={PERMISSIONS.PLATFORM_ADMIN}>
                <PlatformRolesPage />
              </PermissionGuard>
            ),
          },
          {
            path: 'platform/companies',
            element: (
              <PermissionGuard permission={PERMISSIONS.PLATFORM_VIEW_COMPANIES}>
                <PlatformCompaniesPage />
              </PermissionGuard>
            ),
          },
        ],
      },

      // ================================================================
      // SALESPRO APP - Field Sales
      // ================================================================
      {
        path: '/sales',
        element: (
          <AppGuard app="salespro">
            <SalesProLayout />
          </AppGuard>
        ),
        children: [
          {
            index: true,
            element: <SalesProHomePage />,
          },
          // Placeholder routes for future SalesPro pages
          {
            path: 'customers',
            element: <SalesProHomePage />, // Placeholder
          },
          {
            path: 'quotes',
            element: <SalesProHomePage />, // Placeholder
          },
          {
            path: 'measure-sheets',
            element: <SalesProHomePage />, // Placeholder
          },
        ],
      },
    ],
  },

  // ================================================================
  // LEGACY ROUTE REDIRECTS
  // ================================================================
  // Redirect old routes to new /dashboard/* paths for backwards compatibility
  {
    path: '/users',
    element: <Navigate to="/dashboard/users" replace />,
  },
  {
    path: '/roles',
    element: <Navigate to="/dashboard/roles" replace />,
  },
  {
    path: '/offices',
    element: <Navigate to="/dashboard/offices" replace />,
  },
  {
    path: '/admin/settings',
    element: <Navigate to="/dashboard/admin/settings" replace />,
  },
  {
    path: '/admin/data-migration',
    element: <Navigate to="/dashboard/admin/data-migration" replace />,
  },
  {
    path: '/price-guide/*',
    element: <Navigate to="/dashboard/price-guide" replace />,
  },
  {
    path: '/platform/*',
    element: <Navigate to="/dashboard/platform/companies" replace />,
  },

  // Smart redirect routes - uses user's app permissions
  {
    element: (
      <ProtectedRoute>
        <AppProviderWrapper />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/',
        element: <SmartRedirect />,
      },
      {
        path: '*',
        element: <SmartRedirect />,
      },
    ],
  },
]);
