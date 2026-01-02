/**
 * Roles management page.
 * Lists all roles with create/edit/delete capabilities.
 * Actions are conditionally rendered based on user permissions.
 */
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useMemo } from 'react';

import { RequirePermission } from '../components/PermissionGuard';
import { RoleCard } from '../components/roles/RoleCard';
import { RoleDetailDialog } from '../components/roles/RoleDetailDialog';
import { RoleEditDialog } from '../components/roles/RoleEditDialog';
import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';
import { useRolesList, useDeleteRole } from '../hooks/useRoles';
import { handleApiError } from '../lib/api-client';

import type { Role, CreateRoleRequest } from '../types/users';
import type { SelectChangeEvent } from '@mui/material/Select';

/** Filter options for role type (excludes platform - those are in Platform Roles page) */
type RoleTypeFilter = 'all' | 'system' | 'company';

/** Sort options for roles */
type RoleSortOption = 'name-asc' | 'name-desc' | 'created-desc' | 'permissions';

/**
 * Role card skeleton for loading state.
 */
function RoleCardSkeleton(): React.ReactElement {
  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Skeleton variant="text" width="60%" height={28} />
        <Skeleton variant="rounded" width={60} height={24} />
      </Box>
      <Skeleton variant="text" width="40%" height={16} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="100%" height={40} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="30%" height={20} />
    </Box>
  );
}

/**
 * Main roles management page component.
 */
export function RolesPage(): React.ReactElement {
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [cloneRole, setCloneRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<RoleTypeFilter>('all');
  const [sortOption, setSortOption] = useState<RoleSortOption>('name-asc');

  const { data: rolesData, isLoading, refetch } = useRolesList();
  const deleteRoleMutation = useDeleteRole();
  const { hasPermission } = useUserPermissions();

  // Permission flags for UI rendering
  const canCreateRole = hasPermission(PERMISSIONS.ROLE_CREATE);
  const canUpdateRole = hasPermission(PERMISSIONS.ROLE_UPDATE);
  const canDeleteRole = hasPermission(PERMISSIONS.ROLE_DELETE);

  // Filter and sort roles (platform roles are excluded - those are in Platform Roles page)
  const filteredRoles = useMemo(() => {
    if (!rolesData?.roles) return [];

    let roles = [...rolesData.roles];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      roles = roles.filter(
        role =>
          role.name.toLowerCase().includes(query) ||
          role.displayName.toLowerCase().includes(query) ||
          role.description?.toLowerCase().includes(query),
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      roles = roles.filter(role => role.type === typeFilter);
    }

    // Apply sorting
    roles.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.displayName.localeCompare(b.displayName);
        case 'name-desc':
          return b.displayName.localeCompare(a.displayName);
        case 'created-desc':
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case 'permissions':
          return b.permissions.length - a.permissions.length;
        default:
          return 0;
      }
    });

    return roles;
  }, [rolesData?.roles, searchQuery, typeFilter, sortOption]);

  /**
   * Clear all filters.
   */
  function handleClearFilters(): void {
    setSearchQuery('');
    setTypeFilter('all');
    setSortOption('name-asc');
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    typeFilter !== 'all' ||
    sortOption !== 'name-asc';

  /**
   * Handle create role button click.
   */
  function handleCreateClick(): void {
    setIsCreateOpen(true);
    setCloneRole(null);
  }

  /**
   * Handle view role details action.
   */
  function handleViewRole(role: Role): void {
    setViewRole(role);
  }

  /**
   * Handle edit role action.
   */
  function handleEditRole(role: Role): void {
    setViewRole(null);
    setEditRole(role);
  }

  /**
   * Handle delete role action.
   */
  function handleDeleteClick(role: Role): void {
    setViewRole(null);
    setDeleteRole(role);
  }

  /**
   * Handle clone role action.
   */
  function handleCloneRole(role: Role): void {
    setViewRole(null);
    setCloneRole(role);
    setIsCreateOpen(true);
  }

  /**
   * Confirm role deletion.
   */
  async function handleConfirmDelete(force = false): Promise<void> {
    if (!deleteRole) return;

    setError(null);
    try {
      await deleteRoleMutation.mutateAsync({ roleId: deleteRole.id, force });
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
    setCloneRole(null);
  }

  /**
   * Handle role saved.
   */
  function handleRoleSaved(): void {
    void refetch();
  }

  /**
   * Get initial values for create dialog (for cloning).
   */
  function getCloneInitialValues(): Partial<CreateRoleRequest> {
    if (!cloneRole) return {};
    return {
      name: `${cloneRole.name}-copy`,
      displayName: `${cloneRole.displayName} (Copy)`,
      ...(cloneRole.description ? { description: cloneRole.description } : {}),
      permissions: cloneRole.permissions,
      isDefault: false,
    };
  }

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
        <RequirePermission permission={PERMISSIONS.ROLE_CREATE}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateClick}
            data-testid="create-role-btn"
          >
            Create Role
          </Button>
        </RequirePermission>
      </Box>

      {/* Search and Filter Controls */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <TextField
          placeholder="Search roles..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          size="small"
          sx={{ minWidth: 250 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            },
          }}
          data-testid="roles-search-input"
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="role-type-filter-label">Type</InputLabel>
          <Select
            labelId="role-type-filter-label"
            value={typeFilter}
            label="Type"
            onChange={(e: SelectChangeEvent) =>
              setTypeFilter(e.target.value as RoleTypeFilter)
            }
            data-testid="roles-type-filter"
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="company">Custom Only</MenuItem>
            <MenuItem value="system">System Only</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="role-sort-label">Sort By</InputLabel>
          <Select
            labelId="role-sort-label"
            value={sortOption}
            label="Sort By"
            onChange={(e: SelectChangeEvent) =>
              setSortOption(e.target.value as RoleSortOption)
            }
            data-testid="roles-sort-select"
          >
            <MenuItem value="name-asc">Name (A-Z)</MenuItem>
            <MenuItem value="name-desc">Name (Z-A)</MenuItem>
            <MenuItem value="created-desc">Newest First</MenuItem>
            <MenuItem value="permissions">Most Permissions</MenuItem>
          </Select>
        </FormControl>

        {hasActiveFilters && (
          <Button
            variant="text"
            size="small"
            startIcon={<FilterListIcon />}
            onClick={handleClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width={200} height={32} sx={{ mb: 1 }} />
          <Skeleton variant="text" width={300} height={20} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {[1, 2, 3].map(i => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <RoleCardSkeleton />
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" component="h2" gutterBottom>
            All Roles ({filteredRoles.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage custom and system roles. Click a card to view details.
          </Typography>

          {filteredRoles.length === 0 ? (
            <Alert severity="info">
              No roles found matching your criteria.{' '}
              {hasActiveFilters && (
                <Button size="small" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              )}
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {filteredRoles.map(role => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={role.id}>
                  <RoleCard
                    role={role}
                    onClick={handleViewRole}
                    onEdit={canUpdateRole ? handleEditRole : undefined}
                    onDelete={canDeleteRole ? handleDeleteClick : undefined}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* View Role Details Dialog */}
      <RoleDetailDialog
        open={viewRole !== null}
        role={viewRole}
        onClose={() => setViewRole(null)}
        onEdit={canUpdateRole ? handleEditRole : undefined}
        onDelete={canDeleteRole ? handleDeleteClick : undefined}
        onClone={canCreateRole ? handleCloneRole : undefined}
      />

      {/* Create/Edit Dialog */}
      <RoleEditDialog
        open={isCreateOpen || editRole !== null}
        role={editRole}
        onClose={handleDialogClose}
        onSaved={handleRoleSaved}
        initialValues={getCloneInitialValues()}
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
