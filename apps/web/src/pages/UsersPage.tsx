/**
 * Users management page.
 * Lists all users with filtering and edit capabilities.
 * Includes invite functionality and pending invites management.
 */
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

import { InviteUserModal } from '../components/users/InviteUserModal';
import { PendingInvitesList } from '../components/users/PendingInvitesList';
import { UserEditDialog } from '../components/users/UserEditDialog';
import { UserFilters } from '../components/users/UserFilters';
import { UserTable } from '../components/users/UserTable';
import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';
import { useUsersList, useInvitesList } from '../hooks/useUsers';

import type { UsersListParams } from '../types/users';

/**
 * Main users management page component.
 */
export function UsersPage(): React.ReactElement {
  const [tabIndex, setTabIndex] = useState(0);
  const [filters, setFilters] = useState<UsersListParams>({
    page: 1,
    limit: 20,
  });
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const { data, isLoading, error, refetch } = useUsersList(filters);
  const { data: invitesData, refetch: refetchInvites } = useInvitesList();
  const { hasPermission } = useUserPermissions();

  const canInviteUsers = hasPermission(PERMISSIONS.USER_CREATE);
  const pendingInvitesCount = invitesData?.pagination.total ?? 0;

  /**
   * Handle tab change.
   */
  function handleTabChange(_: React.SyntheticEvent, newValue: number): void {
    setTabIndex(newValue);
  }

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

  /**
   * Handle invite sent success.
   */
  function handleInviteSent(): void {
    void refetchInvites();
  }

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <Box>
          <Typography variant="h2" component="h1" gutterBottom>
            Users
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage users, their roles, and office access.
          </Typography>
        </Box>

        {canInviteUsers && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setInviteModalOpen(true)}
          >
            Invite User
          </Button>
        )}
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load users. Please try again.
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label="User management tabs"
        >
          <Tab label="Users" />
          <Tab
            label={`Pending Invites${pendingInvitesCount > 0 ? ` (${pendingInvitesCount})` : ''}`}
          />
        </Tabs>
      </Box>

      {/* Users Tab */}
      {tabIndex === 0 && (
        <>
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
        </>
      )}

      {/* Pending Invites Tab */}
      {tabIndex === 1 && (
        <PendingInvitesList onInviteChange={() => void refetchInvites()} />
      )}

      {/* Edit Dialog */}
      <UserEditDialog
        userId={editUserId}
        open={editUserId !== null}
        onClose={handleEditClose}
        onSaved={handleUserSaved}
      />

      {/* Invite Modal */}
      <InviteUserModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSuccess={handleInviteSent}
      />
    </Box>
  );
}
