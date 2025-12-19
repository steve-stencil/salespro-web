/**
 * Platform role edit/create dialog component.
 * Provides form for creating or editing platform roles.
 */
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useEffect, useMemo } from 'react';

import {
  useCreatePlatformRole,
  useUpdatePlatformRole,
} from '../../hooks/usePlatform';
import { usePermissions } from '../../hooks/useRoles';
import { handleApiError } from '../../lib/api-client';

import type { PlatformRoleWithCount } from '../../types/platform';

type PlatformRoleEditDialogProps = {
  open: boolean;
  role?: PlatformRoleWithCount | null;
  onClose: () => void;
  onSaved: () => void;
};

/** Platform permission prefixes */
const PLATFORM_PERMISSIONS = [
  'platform:admin',
  'platform:view_companies',
  'platform:switch_company',
  'platform:view_audit_logs',
  'platform:manage_internal_users',
];

/** Permission metadata for display */
const PLATFORM_PERMISSION_META: Record<
  string,
  { label: string; description: string }
> = {
  'platform:admin': {
    label: 'Platform Admin',
    description: 'Full platform administration access',
  },
  'platform:view_companies': {
    label: 'View All Companies',
    description: 'View list of all companies in the platform',
  },
  'platform:switch_company': {
    label: 'Switch Company',
    description: 'Switch active company context',
  },
  'platform:view_audit_logs': {
    label: 'View Audit Logs',
    description: 'Access platform-wide audit and activity logs',
  },
  'platform:manage_internal_users': {
    label: 'Manage Internal Users',
    description: 'Create, edit, and manage internal platform users',
  },
};

/**
 * Platform permission picker component.
 */
type PlatformPermissionPickerProps = {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
};

function PlatformPermissionPicker({
  selectedPermissions,
  onChange,
  disabled = false,
}: PlatformPermissionPickerProps): React.ReactElement {
  /**
   * Handle permission toggle.
   */
  function handleToggle(permission: string): void {
    const newPermissions = selectedPermissions.includes(permission)
      ? selectedPermissions.filter(p => p !== permission)
      : [...selectedPermissions, permission];
    onChange(newPermissions);
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        Platform Permissions
      </Typography>
      <FormGroup>
        {PLATFORM_PERMISSIONS.map(permission => {
          const meta = PLATFORM_PERMISSION_META[permission];
          return (
            <FormControlLabel
              key={permission}
              control={
                <Checkbox
                  checked={selectedPermissions.includes(permission)}
                  onChange={() => handleToggle(permission)}
                  disabled={disabled}
                  size="small"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">{meta?.label}</Typography>
                  {meta?.description && (
                    <Typography variant="caption" color="text.secondary">
                      {meta.description}
                    </Typography>
                  )}
                </Box>
              }
              sx={{ mb: 0.5, alignItems: 'flex-start' }}
            />
          );
        })}
      </FormGroup>
    </Paper>
  );
}

/**
 * Company permission picker component.
 * Allows selecting permissions that apply when viewing companies.
 */
type CompanyPermissionPickerProps = {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
};

function CompanyPermissionPicker({
  selectedPermissions,
  onChange,
  disabled = false,
}: CompanyPermissionPickerProps): React.ReactElement {
  const { data: permissionsData, isLoading } = usePermissions();

  // Check if full access is granted
  const hasFullAccess = selectedPermissions.includes('*');

  /**
   * Toggle full access mode.
   */
  function handleFullAccessToggle(checked: boolean): void {
    if (checked) {
      onChange(['*']);
    } else {
      onChange([]);
    }
  }

  /**
   * Handle permission toggle.
   */
  function handleToggle(permission: string): void {
    // Remove full access if toggling individual permissions
    const filtered = selectedPermissions.filter(p => p !== '*');
    const newPermissions = filtered.includes(permission)
      ? filtered.filter(p => p !== permission)
      : [...filtered, permission];
    onChange(newPermissions);
  }

  /**
   * Handle toggling all permissions in a category.
   */
  function handleToggleCategory(
    categoryPermissions: string[],
    checked: boolean,
  ): void {
    const filtered = selectedPermissions.filter(p => p !== '*');
    if (checked) {
      const newPermissions = new Set([...filtered, ...categoryPermissions]);
      onChange(Array.from(newPermissions));
    } else {
      const categorySet = new Set(categoryPermissions);
      onChange(filtered.filter(p => !categorySet.has(p)));
    }
  }

  // Filter out platform permissions from the company permission list
  const companyPermissionsByCategory = useMemo(() => {
    if (!permissionsData?.byCategory) return {};

    const result: Record<string, string[]> = {};
    for (const [category, permissions] of Object.entries(
      permissionsData.byCategory,
    )) {
      if (category === 'Platform') continue;
      result[category] = permissions;
    }
    return result;
  }, [permissionsData]);

  // Get permission metadata for descriptions
  const permissionMeta = useMemo(() => {
    if (!permissionsData?.permissions) return new Map();
    return new Map(permissionsData.permissions.map(p => [p.name, p]));
  }, [permissionsData]);

  /**
   * Check if all permissions in a category are selected.
   */
  function isAllSelected(categoryPermissions: string[]): boolean {
    if (hasFullAccess) return true;
    return categoryPermissions.every(p => selectedPermissions.includes(p));
  }

  /**
   * Check if some (but not all) permissions in a category are selected.
   */
  function isSomeSelected(categoryPermissions: string[]): boolean {
    if (hasFullAccess) return false;
    const count = categoryPermissions.filter(p =>
      selectedPermissions.includes(p),
    ).length;
    return count > 0 && count < categoryPermissions.length;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Full Access Toggle */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: hasFullAccess ? 'success.50' : undefined,
          borderColor: hasFullAccess ? 'success.main' : undefined,
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={hasFullAccess}
              onChange={e => handleFullAccessToggle(e.target.checked)}
              disabled={disabled}
              color="success"
            />
          }
          label={
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                Full Access (Wildcard)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Grant all permissions when viewing any company. Users with this
                can perform any action in any company context.
              </Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', m: 0 }}
        />
        {hasFullAccess && (
          <Chip
            label="*"
            color="success"
            size="small"
            sx={{ mt: 1, fontFamily: 'monospace' }}
          />
        )}
      </Paper>

      {/* Individual Permissions */}
      {!hasFullAccess && (
        <>
          <Typography variant="body2" color="text.secondary">
            Or select specific permissions:
          </Typography>
          {Object.entries(companyPermissionsByCategory).map(
            ([category, permissions]) => {
              const allSelected = isAllSelected(permissions);
              const someSelected = isSomeSelected(permissions);

              return (
                <Paper key={category} variant="outlined" sx={{ p: 2 }}>
                  {/* Category Header */}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={e =>
                          handleToggleCategory(permissions, e.target.checked)
                        }
                        disabled={disabled}
                      />
                    }
                    label={
                      <Typography variant="subtitle2" fontWeight={600}>
                        {category}
                      </Typography>
                    }
                    sx={{ mb: 1 }}
                  />

                  {/* Permission Checkboxes */}
                  <FormGroup sx={{ pl: 3 }}>
                    {permissions.map(permission => {
                      const meta = permissionMeta.get(permission);
                      return (
                        <FormControlLabel
                          key={permission}
                          control={
                            <Checkbox
                              checked={selectedPermissions.includes(permission)}
                              onChange={() => handleToggle(permission)}
                              disabled={disabled}
                              size="small"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2">
                                {meta?.label ?? permission}
                              </Typography>
                              {meta?.description && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {meta.description}
                                </Typography>
                              )}
                            </Box>
                          }
                          sx={{ mb: 0.5, alignItems: 'flex-start' }}
                        />
                      );
                    })}
                  </FormGroup>
                </Paper>
              );
            },
          )}
        </>
      )}
    </Box>
  );
}

/**
 * Dialog for creating or editing a platform role.
 */
export function PlatformRoleEditDialog({
  open,
  role,
  onClose,
  onSaved,
}: PlatformRoleEditDialogProps): React.ReactElement {
  const isEditing = !!role;

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [platformPermissions, setPlatformPermissions] = useState<string[]>([]);
  const [companyPermissions, setCompanyPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    displayName?: string;
    platformPermissions?: string;
  }>({});

  const createRoleMutation = useCreatePlatformRole();
  const updateRoleMutation = useUpdatePlatformRole();

  // Initialize form when role changes
  useEffect(() => {
    if (role) {
      setName(role.name);
      setDisplayName(role.displayName);
      setDescription(role.description ?? '');
      setPlatformPermissions(
        role.permissions?.filter(p => p.startsWith('platform:')) ?? [],
      );
      setCompanyPermissions(role.companyPermissions ?? []);
    } else {
      setName('');
      setDisplayName('');
      setDescription('');
      setPlatformPermissions([]);
      setCompanyPermissions([]);
    }
    setError(null);
    setValidationErrors({});
  }, [role, open]);

  /**
   * Validate form fields.
   */
  function validate(): boolean {
    const errors: typeof validationErrors = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      errors.name =
        'Name must start with a letter and contain only letters, numbers, hyphens, and underscores';
    }

    if (!displayName.trim()) {
      errors.displayName = 'Display name is required';
    }

    if (platformPermissions.length === 0) {
      errors.platformPermissions =
        'At least one platform permission is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Handle form submission.
   */
  async function handleSubmit(): Promise<void> {
    if (!validate()) return;

    setError(null);

    try {
      if (role) {
        await updateRoleMutation.mutateAsync({
          roleId: role.id,
          data: {
            displayName,
            description: description || null,
            permissions: platformPermissions,
            companyPermissions,
          },
        });
      } else {
        await createRoleMutation.mutateAsync({
          name,
          displayName,
          description: description || undefined,
          permissions: platformPermissions,
          companyPermissions,
        });
      }
      onSaved();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  const isLoading =
    createRoleMutation.isPending || updateRoleMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          {role ? `Edit Role: ${role.displayName}` : 'Create Platform Role'}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {/* Name field - only editable when creating */}
          <TextField
            label="Role Name"
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (validationErrors.name) {
                setValidationErrors(prev => ({ ...prev, name: undefined }));
              }
            }}
            error={!!validationErrors.name}
            helperText={
              validationErrors.name ??
              (isEditing
                ? 'Role name cannot be changed'
                : 'Unique identifier (e.g., platform-admin, support-readonly)')
            }
            disabled={isEditing}
            fullWidth
          />

          <TextField
            label="Display Name"
            value={displayName}
            onChange={e => {
              setDisplayName(e.target.value);
              if (validationErrors.displayName) {
                setValidationErrors(prev => ({
                  ...prev,
                  displayName: undefined,
                }));
              }
            }}
            error={!!validationErrors.displayName}
            helperText={
              validationErrors.displayName ??
              'Human-readable name (e.g., Platform Administrator)'
            }
            fullWidth
          />

          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            helperText="Optional description of this role's purpose"
            multiline
            rows={2}
            fullWidth
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Platform Permissions Section */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Platform Permissions
        </Typography>
        {validationErrors.platformPermissions && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {validationErrors.platformPermissions}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select platform-level permissions for internal user actions.{' '}
          <strong>{platformPermissions.length}</strong> selected.
        </Typography>

        <PlatformPermissionPicker
          selectedPermissions={platformPermissions}
          onChange={newPermissions => {
            setPlatformPermissions(newPermissions);
            if (validationErrors.platformPermissions) {
              setValidationErrors(prev => ({
                ...prev,
                platformPermissions: undefined,
              }));
            }
          }}
          disabled={isLoading}
        />

        <Divider sx={{ my: 3 }} />

        {/* Company Permissions Section */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Company Permissions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Define what actions this role can perform when viewing a
          company&apos;s data. Grant full access or select specific permissions.
        </Typography>

        <CompanyPermissionPicker
          selectedPermissions={companyPermissions}
          onChange={setCompanyPermissions}
          disabled={isLoading}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isLoading}
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {isEditing ? 'Save Changes' : 'Create Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
