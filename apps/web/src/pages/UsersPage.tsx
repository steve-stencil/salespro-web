/**
 * Users management page.
 * Lists all users with filtering and edit capabilities.
 */
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

import { UserEditDialog } from '../components/users/UserEditDialog';
import { UserFilters } from '../components/users/UserFilters';
import { UserTable } from '../components/users/UserTable';
import { useUsersList } from '../hooks/useUsers';

import type { UsersListParams } from '../types/users';

/**
 * Main users management page component.
 */
export function UsersPage(): React.ReactElement {
  const [filters, setFilters] = useState<UsersListParams>({
    page: 1,
    limit: 20,
  });
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useUsersList(filters);

  /**
   * Handle search filter change.
   */
  const handleSearchChange = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  /**
   * Handle office filter change.
   */
  const handleOfficeChange = useCallback((officeId: string) => {
    setFilters(prev => ({ ...prev, officeId: officeId || undefined, page: 1 }));
  }, []);

  /**
   * Handle active status filter change.
   */
  const handleActiveChange = useCallback((isActive: boolean | undefined) => {
    setFilters(prev => ({ ...prev, isActive, page: 1 }));
  }, []);

  /**
   * Handle page change.
   */
  function handlePageChange(page: number): void {
    setFilters(prev => ({ ...prev, page }));
  }

  /**
   * Handle rows per page change.
   */
  function handleRowsPerPageChange(limit: number): void {
    setFilters(prev => ({ ...prev, limit, page: 1 }));
  }

  /**
   * Handle edit user action.
   */
  function handleEditUser(userId: string): void {
    setEditUserId(userId);
  }

  /**
   * Handle edit dialog close.
   */
  function handleEditClose(): void {
    setEditUserId(null);
  }

  /**
   * Handle user saved.
   */
  function handleUserSaved(): void {
    void refetch();
  }

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Users
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage users, their roles, and office access.
        </Typography>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load users. Please try again.
        </Alert>
      )}

      {/* Filters */}
      <UserFilters
        onSearchChange={handleSearchChange}
        onOfficeChange={handleOfficeChange}
        onActiveChange={handleActiveChange}
        initialSearch={filters.search}
        initialOfficeId={filters.officeId}
        initialIsActive={filters.isActive}
      />

      {/* Users Table */}
      <UserTable
        users={data?.users ?? []}
        pagination={
          data?.pagination ?? {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          }
        }
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        onEditUser={handleEditUser}
      />

      {/* Edit Dialog */}
      <UserEditDialog
        userId={editUserId}
        open={editUserId !== null}
        onClose={handleEditClose}
        onSaved={handleUserSaved}
      />
    </Box>
  );
}
