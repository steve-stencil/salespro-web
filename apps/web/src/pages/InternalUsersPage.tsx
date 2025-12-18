/**
 * Internal Users Page
 *
 * Platform administration page for managing internal (platform) users.
 * Allows creating, editing, and deleting internal users who can access
 * the platform administration features.
 *
 * This page is only accessible to internal users with the
 * platform:manage_internal_users permission.
 */
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import {
  InternalUserTable,
  InternalUserEditDialog,
  InternalUserCreateDialog,
} from '../components/platform';
import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';
import { useInternalUsers } from '../hooks/usePlatform';

/**
 * Page for managing internal platform users.
 */
export function InternalUsersPage(): React.ReactElement {
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useInternalUsers();
  const { hasPermission } = useUserPermissions();

  const canManage = hasPermission(PERMISSIONS.PLATFORM_MANAGE_INTERNAL_USERS);

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
   * Handle user saved (created or updated).
   */
  function handleUserSaved(): void {
    void refetch();
  }

  /**
   * Handle create success.
   */
  function handleCreateSuccess(): void {
    void refetch();
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
            Internal Users
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage platform administrators and their access levels.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => void refetch()} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {canManage && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Add Internal User
            </Button>
          )}
        </Box>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load internal users. Please try again.
        </Alert>
      )}

      {/* Users Table */}
      <InternalUserTable
        users={data?.users ?? []}
        isLoading={isLoading}
        onEditUser={handleEditUser}
      />

      {/* Edit Dialog */}
      <InternalUserEditDialog
        userId={editUserId}
        open={editUserId !== null}
        onClose={handleEditClose}
        onSaved={handleUserSaved}
      />

      {/* Create Dialog */}
      <InternalUserCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </Box>
  );
}
