/**
 * Role edit/create dialog component.
 * Provides form for creating or editing roles with permission picker.
 */
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useEffect } from 'react';

import { useCreateRole, useUpdateRole } from '../../hooks/useRoles';
import { handleApiError } from '../../lib/api-client';

import { PermissionPicker } from './PermissionPicker';

import type {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../../types/users';

type RoleEditDialogProps = {
  open: boolean;
  role?: Role | null;
  onClose: () => void;
  onSaved: () => void;
  /** Initial values for creating a new role (e.g., when cloning) */
  initialValues?: Partial<CreateRoleRequest> | undefined;
};

/**
 * Dialog for creating or editing a role.
 */
export function RoleEditDialog({
  open,
  role,
  onClose,
  onSaved,
  initialValues,
}: RoleEditDialogProps): React.ReactElement {
  const isEditing = !!role;
  const isCloning = !role && !!initialValues;

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    displayName?: string;
    permissions?: string;
  }>({});

  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();

  // Initialize form when role or initialValues changes
  useEffect(() => {
    if (role) {
      // Editing existing role
      setName(role.name);
      setDisplayName(role.displayName);
      setDescription(role.description ?? '');
      setPermissions(role.permissions);
      setIsDefault(role.isDefault);
    } else if (initialValues) {
      // Cloning from initialValues
      setName(initialValues.name ?? '');
      setDisplayName(initialValues.displayName ?? '');
      setDescription(initialValues.description ?? '');
      setPermissions(initialValues.permissions ?? []);
      setIsDefault(initialValues.isDefault ?? false);
    } else {
      // Creating new role
      setName('');
      setDisplayName('');
      setDescription('');
      setPermissions([]);
      setIsDefault(false);
    }
    setError(null);
    setValidationErrors({});
  }, [role, initialValues, open]);

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

    if (permissions.length === 0) {
      errors.permissions = 'At least one permission is required';
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
        const updateData: UpdateRoleRequest = {
          displayName,
          ...(description && { description }),
          permissions,
          isDefault,
        };
        await updateRoleMutation.mutateAsync({
          roleId: role.id,
          data: updateData,
        });
      } else {
        const createData: CreateRoleRequest = {
          name,
          displayName,
          ...(description && { description }),
          permissions,
          isDefault,
        };
        await createRoleMutation.mutateAsync(createData);
      }
      onSaved();
      onClose();
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
          {role
            ? `Edit Role: ${role.displayName}`
            : isCloning
              ? 'Clone Role'
              : 'Create New Role'}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
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
                : 'Unique identifier (e.g., salesRep, officeManager)')
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
              'Human-readable name (e.g., Sales Representative)'
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

          <FormControlLabel
            control={
              <Switch
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
              />
            }
            label="Default role (automatically assigned to new users)"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Permissions Section */}
        <Typography variant="subtitle2" gutterBottom>
          Permissions
        </Typography>
        {validationErrors.permissions && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {validationErrors.permissions}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the permissions this role should grant.{' '}
          <strong>{permissions.length}</strong> selected.
        </Typography>

        <PermissionPicker
          selectedPermissions={permissions}
          onChange={newPermissions => {
            setPermissions(newPermissions);
            if (validationErrors.permissions) {
              setValidationErrors(prev => ({
                ...prev,
                permissions: undefined,
              }));
            }
          }}
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
