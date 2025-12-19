/**
 * Platform Roles Page
 *
 * Manages platform roles that control internal user permissions.
 * Allows creating, editing, and deleting platform roles.
 * Only accessible to internal users with platform:admin permission.
 */
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { PlatformRoleEditDialog } from '../components/platform/PlatformRoleEditDialog';
import {
  usePlatformRolesAdmin,
  useDeletePlatformRole,
} from '../hooks/usePlatform';
import { handleApiError } from '../lib/api-client';

import type { PlatformRoleWithCount } from '../types/platform';

/**
 * Role card skeleton for loading state.
 */
function RoleCardSkeleton(): React.ReactElement {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="rounded" width={60} height={24} />
        </Box>
        <Skeleton variant="text" width="80%" height={20} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="100%" height={40} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="rounded" width={100} height={24} />
        </Box>
      </CardContent>
    </Card>
  );
}

/**
 * Platform role card component.
 */
type PlatformRoleCardProps = {
  role: PlatformRoleWithCount;
  onEdit: (role: PlatformRoleWithCount) => void;
  onDelete: (role: PlatformRoleWithCount) => void;
};

function PlatformRoleCard({
  role,
  onEdit,
  onDelete,
}: PlatformRoleCardProps): React.ReactElement {
  const hasFullAccess = role.companyPermissions?.includes('*');

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="h6" component="h3" noWrap>
              {role.displayName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Edit role">
              <IconButton
                size="small"
                onClick={() => onEdit(role)}
                data-testid={`edit-role-${role.id}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={
                role.userCount > 0
                  ? `Cannot delete: ${role.userCount} user(s) assigned`
                  : 'Delete role'
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={() => onDelete(role)}
                  disabled={role.userCount > 0}
                  data-testid={`delete-role-${role.id}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Name (system identifier) */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: 'monospace', display: 'block', mb: 1 }}
        >
          {role.name}
        </Typography>

        {/* Description */}
        {role.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {role.description}
          </Typography>
        )}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            size="small"
            label={`${role.userCount} user${role.userCount !== 1 ? 's' : ''}`}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`${role.permissions?.length ?? 0} platform permissions`}
            variant="outlined"
          />
        </Box>

        {/* Company Access */}
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Company Access:
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {hasFullAccess ? (
              <Chip
                size="small"
                label="Full Access (*)"
                color="success"
                variant="filled"
              />
            ) : role.companyPermissions &&
              role.companyPermissions.length > 0 ? (
              <>
                {role.companyPermissions.slice(0, 3).map(perm => (
                  <Chip
                    key={perm}
                    size="small"
                    label={perm}
                    variant="outlined"
                    sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                  />
                ))}
                {role.companyPermissions.length > 3 && (
                  <Chip
                    size="small"
                    label={`+${role.companyPermissions.length - 3} more`}
                    variant="outlined"
                  />
                )}
              </>
            ) : (
              <Chip size="small" label="No company access" variant="outlined" />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

/**
 * Platform Roles management page.
 */
export function PlatformRolesPage(): React.ReactElement {
  const [editRole, setEditRole] = useState<PlatformRoleWithCount | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<PlatformRoleWithCount | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, refetch } = usePlatformRolesAdmin();
  const deleteRoleMutation = useDeletePlatformRole();

  /**
   * Handle create role button click.
   */
  function handleCreateClick(): void {
    setIsCreateOpen(true);
  }

  /**
   * Handle edit role action.
   */
  function handleEditRole(role: PlatformRoleWithCount): void {
    setEditRole(role);
  }

  /**
   * Handle delete role action.
   */
  function handleDeleteClick(role: PlatformRoleWithCount): void {
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
    handleDialogClose();
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
            Platform Roles
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage roles for internal platform users and their permissions.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => void refetch()} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateClick}
            data-testid="create-platform-role-btn"
          >
            Create Role
          </Button>
        </Box>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3].map(i => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <RoleCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : data?.roles && data.roles.length > 0 ? (
        <Grid container spacing={2}>
          {data.roles.map(role => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={role.id}>
              <PlatformRoleCard
                role={role}
                onEdit={handleEditRole}
                onDelete={handleDeleteClick}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          No platform roles found. Create one to get started.
        </Alert>
      )}

      {/* Create/Edit Dialog */}
      <PlatformRoleEditDialog
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
        <DialogTitle id="delete-dialog-title">Delete Platform Role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the platform role &quot;
            {deleteRole?.displayName}&quot;? This action cannot be undone.
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
