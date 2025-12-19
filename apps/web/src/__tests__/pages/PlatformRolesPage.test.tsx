/**
 * Tests for PlatformRolesPage component.
 * Verifies platform role management functionality.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AuthContext } from '../../context/AuthContext';
import { PlatformRolesPage } from '../../pages/PlatformRolesPage';
import { platformApi } from '../../services/platform';
import { rolesApi } from '../../services/roles';

import type { AuthContextType, User } from '../../types/auth';
import type {
  PlatformRolesAdminResponse,
  PlatformRoleWithCount,
} from '../../types/platform';

// Mock the APIs
vi.mock('../../services/platform', () => ({
  platformApi: {
    getPlatformRolesAdmin: vi.fn(),
    createPlatformRole: vi.fn(),
    updatePlatformRole: vi.fn(),
    deletePlatformRole: vi.fn(),
    getPlatformRole: vi.fn(),
  },
}));

vi.mock('../../services/roles', () => ({
  rolesApi: {
    getPermissions: vi.fn(),
    getMyRoles: vi.fn(),
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

const mockInternalUser: User = {
  id: 'user-123',
  email: 'admin@platform.com',
  nameFirst: 'Admin',
  nameLast: 'User',
  emailVerified: true,
  mfaEnabled: false,
  userType: 'internal',
  company: { id: 'company-1', name: 'Test Company' },
  canSwitchCompanies: true,
};

const mockPlatformRoles: PlatformRoleWithCount[] = [
  {
    id: 'role-1',
    name: 'platform-admin',
    displayName: 'Platform Admin',
    description: 'Full platform administration access',
    permissions: ['platform:admin', 'platform:view_companies'],
    companyPermissions: ['*'],
    userCount: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-2',
    name: 'support-readonly',
    displayName: 'Support Read-Only',
    description: 'Read-only access for support team',
    permissions: ['platform:view_companies'],
    companyPermissions: ['customer:read', 'user:read'],
    userCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockPlatformRolesResponse: PlatformRolesAdminResponse = {
  roles: mockPlatformRoles,
};

const mockPermissionsResponse = {
  permissions: [
    {
      name: 'customer:read',
      label: 'View Customers',
      category: 'Customers',
      description: 'View customer list',
    },
    {
      name: 'customer:create',
      label: 'Create Customers',
      category: 'Customers',
      description: 'Create customers',
    },
    {
      name: 'user:read',
      label: 'View Users',
      category: 'Users',
      description: 'View users',
    },
    {
      name: 'platform:admin',
      label: 'Platform Admin',
      category: 'Platform',
      description: 'Full platform access',
    },
    {
      name: 'platform:view_companies',
      label: 'View Companies',
      category: 'Platform',
      description: 'View companies',
    },
  ],
  byCategory: {
    Customers: ['customer:read', 'customer:create'],
    Users: ['user:read'],
    Platform: ['platform:admin', 'platform:view_companies'],
  },
};

const mockMyRolesResponse = {
  roles: [
    {
      id: 'role-1',
      name: 'platform-admin',
      displayName: 'Platform Admin',
      type: 'platform',
    },
  ],
  permissions: ['platform:admin', 'platform:view_companies', '*'],
};

function createMockAuthContext(
  overrides: Partial<AuthContextType> = {},
): AuthContextType {
  return {
    user: mockInternalUser,
    isLoading: false,
    isAuthenticated: true,
    requiresMfa: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    verifyMfa: vi.fn(),
    clearMfaState: vi.fn(),
    ...overrides,
  };
}

type RenderOptions = {
  authContext?: AuthContextType;
  initialPath?: string;
};

function renderPlatformRolesPage(options: RenderOptions = {}): {
  queryClient: QueryClient;
} {
  const queryClient = createQueryClient();
  const authContext = options.authContext ?? createMockAuthContext();

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authContext}>
        <MemoryRouter
          initialEntries={[options.initialPath ?? '/platform/roles']}
        >
          <Routes>
            <Route path="/platform/roles" element={<PlatformRolesPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

  return { queryClient };
}

// ============================================================================
// Tests
// ============================================================================

describe('PlatformRolesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.getPlatformRolesAdmin).mockResolvedValue(
      mockPlatformRolesResponse,
    );
    vi.mocked(rolesApi.getPermissions).mockResolvedValue(
      mockPermissionsResponse,
    );
    vi.mocked(rolesApi.getMyRoles).mockResolvedValue(mockMyRolesResponse);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('should display the page title and description', () => {
      renderPlatformRolesPage();

      expect(screen.getByText('Platform Roles')).toBeInTheDocument();
      expect(
        screen.getByText(/Manage roles for internal platform users/i),
      ).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      vi.mocked(platformApi.getPlatformRolesAdmin).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderPlatformRolesPage();

      // Should show loading skeleton
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display platform roles after loading', async () => {
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      expect(screen.getByText('Support Read-Only')).toBeInTheDocument();
    });

    it('should display user count for each role', async () => {
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('2 users')).toBeInTheDocument();
      });

      expect(screen.getByText('0 users')).toBeInTheDocument();
    });

    it('should display company access type', async () => {
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Full Access (*)')).toBeInTheDocument();
      });

      // Support role has specific permissions
      expect(screen.getByText('customer:read')).toBeInTheDocument();
    });

    it('should display create role button', async () => {
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /create role/i }),
        ).toBeInTheDocument();
      });
    });

    it('should display empty state when no roles exist', async () => {
      vi.mocked(platformApi.getPlatformRolesAdmin).mockResolvedValue({
        roles: [],
      });

      renderPlatformRolesPage();

      await waitFor(() => {
        expect(
          screen.getByText(/No platform roles found/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('role actions', () => {
    it('should show edit button for each role', async () => {
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId(/edit-role-/);
      expect(editButtons).toHaveLength(2);
    });

    it('should show delete button for roles with no users', async () => {
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Support Read-Only')).toBeInTheDocument();
      });

      // Role with 0 users should have enabled delete button
      const deleteButton = screen.getByTestId('delete-role-role-2');
      expect(deleteButton).not.toBeDisabled();
    });

    it('should disable delete button for roles with users', async () => {
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      // Role with 2 users should have disabled delete button
      const deleteButton = screen.getByTestId('delete-role-role-1');
      expect(deleteButton).toBeDisabled();
    });

    it('should open create dialog when clicking create button', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create role/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Create Platform Role')).toBeInTheDocument();
      });
    });

    it('should open edit dialog when clicking edit button', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-role-role-1');
      await user.click(editButton);

      await waitFor(() => {
        expect(
          screen.getByText('Edit Role: Platform Admin'),
        ).toBeInTheDocument();
      });
    });

    it('should open delete confirmation when clicking delete button', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Support Read-Only')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-role-role-2');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete Platform Role')).toBeInTheDocument();
      });
    });
  });

  describe('delete flow', () => {
    it('should delete role when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(platformApi.deletePlatformRole).mockResolvedValue(undefined);

      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Support Read-Only')).toBeInTheDocument();
      });

      // Click delete
      const deleteButton = screen.getByTestId('delete-role-role-2');
      await user.click(deleteButton);

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText('Delete Platform Role')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(platformApi.deletePlatformRole).toHaveBeenCalledWith('role-2');
      });
    });

    it('should close dialog when canceling delete', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Support Read-Only')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-role-role-2');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete Platform Role')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Delete Platform Role'),
        ).not.toBeInTheDocument();
      });
    });

    it('should show error when delete fails', async () => {
      const user = userEvent.setup();
      vi.mocked(platformApi.deletePlatformRole).mockRejectedValue(
        new Error('Cannot delete role'),
      );

      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Support Read-Only')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-role-role-2');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete Platform Role')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('refresh functionality', () => {
    it('should refresh data when clicking refresh button', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      // Clear the mock to count fresh calls
      vi.mocked(platformApi.getPlatformRolesAdmin).mockClear();
      vi.mocked(platformApi.getPlatformRolesAdmin).mockResolvedValue(
        mockPlatformRolesResponse,
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(platformApi.getPlatformRolesAdmin).toHaveBeenCalled();
      });
    });
  });
});

describe('PlatformRoleEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.getPlatformRolesAdmin).mockResolvedValue(
      mockPlatformRolesResponse,
    );
    vi.mocked(rolesApi.getPermissions).mockResolvedValue(
      mockPermissionsResponse,
    );
    vi.mocked(rolesApi.getMyRoles).mockResolvedValue(mockMyRolesResponse);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create mode', () => {
    it('should create a new role when form is submitted', async () => {
      const user = userEvent.setup();
      vi.mocked(platformApi.createPlatformRole).mockResolvedValue({
        id: 'new-role-id',
        name: 'new-role',
        displayName: 'New Role',
        permissions: ['platform:view_companies'],
        companyPermissions: [],
        userCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      // Open create dialog
      const createButton = screen.getByRole('button', { name: /create role/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Create Platform Role')).toBeInTheDocument();
      });

      // Fill form
      const nameInput = screen.getByLabelText(/role name/i);
      await user.type(nameInput, 'new-role');

      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.type(displayNameInput, 'New Role');

      // Select a platform permission
      const viewCompaniesCheckbox = screen.getByLabelText(/view companies/i);
      await user.click(viewCompaniesCheckbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: /create role/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(platformApi.createPlatformRole).toHaveBeenCalled();
      });
    });

    it('should show validation error for missing name', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create role/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Create Platform Role')).toBeInTheDocument();
      });

      // Try to submit without filling name
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.type(displayNameInput, 'New Role');

      const viewCompaniesCheckbox = screen.getByLabelText(/view companies/i);
      await user.click(viewCompaniesCheckbox);

      const submitButton = screen.getByRole('button', { name: /create role/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('edit mode', () => {
    it('should pre-fill form with existing role data', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-role-role-1');
      await user.click(editButton);

      await waitFor(() => {
        expect(
          screen.getByText('Edit Role: Platform Admin'),
        ).toBeInTheDocument();
      });

      // Name field should be disabled in edit mode
      const nameInput = screen.getByLabelText(/role name/i);
      expect(nameInput).toBeDisabled();
      expect(nameInput).toHaveValue('platform-admin');

      // Display name should be pre-filled
      const displayNameInput = screen.getByLabelText(/display name/i);
      expect(displayNameInput).toHaveValue('Platform Admin');
    });

    it('should update role when form is submitted', async () => {
      const user = userEvent.setup();
      vi.mocked(platformApi.updatePlatformRole).mockResolvedValue({
        id: 'role-1',
        name: 'platform-admin',
        displayName: 'Updated Admin',
        description: 'Full platform administration access',
        permissions: ['platform:admin', 'platform:view_companies'],
        companyPermissions: ['*'],
        userCount: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-role-role-1');
      await user.click(editButton);

      await waitFor(() => {
        expect(
          screen.getByText('Edit Role: Platform Admin'),
        ).toBeInTheDocument();
      });

      // Update display name
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Admin');

      const submitButton = screen.getByRole('button', {
        name: /save changes/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(platformApi.updatePlatformRole).toHaveBeenCalledWith(
          'role-1',
          expect.objectContaining({
            displayName: 'Updated Admin',
          }),
        );
      });
    });
  });

  describe('close behavior', () => {
    it('should close dialog when clicking close button', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create role/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Create Platform Role')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Create Platform Role'),
        ).not.toBeInTheDocument();
      });
    });

    it('should close dialog when clicking cancel button', async () => {
      const user = userEvent.setup();
      renderPlatformRolesPage();

      await waitFor(() => {
        expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create role/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Create Platform Role')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Create Platform Role'),
        ).not.toBeInTheDocument();
      });
    });
  });
});
