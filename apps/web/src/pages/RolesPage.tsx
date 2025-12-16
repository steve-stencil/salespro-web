/**
 * Roles management page.
 * Lists all roles with create/edit/delete capabilities.
 */
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { RoleCard } from '../components/roles/RoleCard';
import { RoleEditDialog } from '../components/roles/RoleEditDialog';
import { useRolesList, useDeleteRole } from '../hooks/useRoles';
import { handleApiError } from '../lib/api-client';

import type { Role } from '../types/users';

/**
 * Main roles management page component.
 */
export function RolesPage(): React.ReactElement {
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: rolesData, isLoading, refetch } = useRolesList();
  const deleteRoleMutation = useDeleteRole();

  /**
   * Handle create role button click.
   */
  function handleCreateClick(): void {
    setIsCreateOpen(true);
  }

  /**
   * Handle edit role action.
   */
  function handleEditRole(role: Role): void {
    setEditRole(role);
  }

  /**
   * Handle delete role action.
   */
  function handleDeleteClick(role: Role): void {
    setDeleteRole(role);
  }

  /**
   * Confirm role deletion.
   */
  async function handleConfirmDelete(): Promise<void> {
    if (!deleteRole) return;

    setError(null);
    try {
      await deleteRoleMutation.mutateAsync(deleteRole.id);
      setDeleteRole(null);
      void refetch();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle dialog close.
   */
  function handleDialogClose(): void {
    setEditRole(null);
    setIsCreateOpen(false);
  }

  /**
   * Handle role saved.
   */
  function handleRoleSaved(): void {
    void refetch();
  }

  // Separate system and company roles
  const systemRoles = rolesData?.roles.filter(r => r.type === 'system') ?? [];
  const companyRoles = rolesData?.roles.filter(r => r.type === 'company') ?? [];

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h2" component="h1" gutterBottom>
            Roles
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage roles and permissions for your company.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create Role
        </Button>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Company Roles */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h3" component="h2" gutterBottom>
              Custom Roles ({companyRoles.length})
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Roles created for your company.
            </Typography>

            {companyRoles.length === 0 ? (
              <Alert severity="info">
                No custom roles created yet. Click &quot;Create Role&quot; to
                add one.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {companyRoles.map(role => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={role.id}>
                    <RoleCard
                      role={role}
                      onEdit={handleEditRole}
                      onDelete={handleDeleteClick}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>

          {/* System Roles */}
          <Box>
            <Typography variant="h3" component="h2" gutterBottom>
              System Roles ({systemRoles.length})
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Built-in roles that cannot be modified or deleted.
            </Typography>

            {systemRoles.length === 0 ? (
              <Alert severity="info">No system roles available.</Alert>
            ) : (
              <Grid container spacing={2}>
                {systemRoles.map(role => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={role.id}>
                    <RoleCard
                      role={role}
                      onEdit={handleEditRole}
                      onDelete={handleDeleteClick}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </>
      )}

      {/* Create/Edit Dialog */}
      <RoleEditDialog
        open={isCreateOpen || editRole !== null}
        role={editRole}
        onClose={handleDialogClose}
        onSaved={handleRoleSaved}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteRole !== null}
        onClose={() => setDeleteRole(null)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Delete Role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the role &quot;
            {deleteRole?.displayName}&quot;? This action cannot be undone.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            Users with this role will lose the associated permissions.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteRole(null)}>Cancel</Button>
          <Button
            onClick={() => void handleConfirmDelete()}
            color="error"
            variant="contained"
            disabled={deleteRoleMutation.isPending}
            startIcon={
              deleteRoleMutation.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
