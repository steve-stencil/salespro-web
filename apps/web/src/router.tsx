/**
 * Application router configuration.
 * Defines all routes and their components.
 *
 * The app serves as a unified shell for both web and mobile applications.
 * Access to each app is controlled by app:web and app:mobile permissions.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { PermissionGuard } from './components/PermissionGuard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SmartRedirect } from './components/SmartRedirect';
import { PERMISSIONS } from './hooks/usePermissions';
import { AppLayout } from './layouts/AppLayout';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { CompanySettingsPage } from './pages/CompanySettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { InternalUsersPage } from './pages/InternalUsersPage';
import { LoginPage } from './pages/LoginPage';
import { MfaVerifyPage } from './pages/MfaVerifyPage';
import { MobileContractPage } from './pages/MobileContractPage';
import { MobileDraftsPage } from './pages/MobileDraftsPage';
import { OfficesPage } from './pages/OfficesPage';
import { PlatformCompaniesPage } from './pages/PlatformCompaniesPage';
import { PlatformRolesPage } from './pages/PlatformRolesPage';
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
 * Protected routes - Web App (require app:web permission):
 * - /dashboard - Main dashboard
 * - /users - User management
 * - /roles - Role management
 * - /offices - Office management
 * - /admin/settings - Company settings (admin)
 * - /platform/* - Platform management (internal users)
 *
 * Protected routes - Mobile App (require app:mobile permission):
 * - /mobile/contracts - Mobile contract list
 * - /mobile/contracts/:estimateId - Mobile contract preview
 * - /mobile/drafts - Mobile drafts list
 *
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

  // Protected routes with AppLayout (unified shell)
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      // ================================================
      // Web App Routes (require app:web permission)
      // ================================================
      {
        path: '/dashboard',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <DashboardPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/users',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <PermissionGuard permission={PERMISSIONS.USER_READ}>
              <UsersPage />
            </PermissionGuard>
          </PermissionGuard>
        ),
      },
      {
        path: '/roles',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <PermissionGuard permission={PERMISSIONS.ROLE_READ}>
              <RolesPage />
            </PermissionGuard>
          </PermissionGuard>
        ),
      },
      {
        path: '/offices',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <PermissionGuard permission={PERMISSIONS.OFFICE_READ}>
              <OfficesPage />
            </PermissionGuard>
          </PermissionGuard>
        ),
      },
      {
        path: '/admin/settings',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <PermissionGuard permission={PERMISSIONS.COMPANY_UPDATE}>
              <CompanySettingsPage />
            </PermissionGuard>
          </PermissionGuard>
        ),
      },
      {
        path: '/platform/internal-users',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <PermissionGuard
              permission={PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS}
            >
              <InternalUsersPage />
            </PermissionGuard>
          </PermissionGuard>
        ),
      },
      {
        path: '/platform/roles',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <PermissionGuard permission={PERMISSIONS.PLATFORM_ADMIN}>
              <PlatformRolesPage />
            </PermissionGuard>
          </PermissionGuard>
        ),
      },
      {
        path: '/platform/companies',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_WEB}>
            <PermissionGuard permission={PERMISSIONS.PLATFORM_VIEW_COMPANIES}>
              <PlatformCompaniesPage />
            </PermissionGuard>
          </PermissionGuard>
        ),
      },

      // ================================================
      // Mobile App Routes (require app:mobile permission)
      // ================================================
      {
        path: '/mobile/contracts',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_MOBILE}>
            <MobileContractPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/mobile/contracts/:estimateId',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_MOBILE}>
            <MobileContractPage />
          </PermissionGuard>
        ),
      },
      {
        path: '/mobile/drafts',
        element: (
          <PermissionGuard permission={PERMISSIONS.APP_MOBILE}>
            <MobileDraftsPage />
          </PermissionGuard>
        ),
      },
      // Legacy mobile route (redirect to new path)
      {
        path: '/mobile/contract',
        element: <Navigate to="/mobile/contracts" replace />,
      },
      {
        path: '/mobile/contract/:estimateId',
        element: <Navigate to="/mobile/contracts/:estimateId" replace />,
      },
    ],
  },

  // Root redirect - smart redirect based on user's app permissions
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <SmartRedirect />
      </ProtectedRoute>
    ),
  },

  // Catch-all - redirect to smart redirect to determine best destination
  {
    path: '*',
    element: (
      <ProtectedRoute>
        <SmartRedirect />
      </ProtectedRoute>
    ),
  },
]);
