/**
 * Role detail dialog component.
 * Displays role information and permissions in a read-only view.
 */
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { usePermissions } from '../../hooks/useRoles';

import type { Role } from '../../types/users';

type RoleDetailDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** The role to display */
  role: Role | null;
  /** Handler for closing the dialog */
  onClose: () => void;
  /** Handler for edit action (optional, hides edit button if not provided) */
  onEdit?: ((role: Role) => void) | undefined;
  /** Handler for delete action (optional, hides delete button if not provided) */
  onDelete?: ((role: Role) => void) | undefined;
  /** Handler for clone action (optional, hides clone button if not provided) */
  onClone?: ((role: Role) => void) | undefined;
};

/**
 * Format a date string for display.
 */
function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Dialog for viewing role details in read-only mode.
 */
export function RoleDetailDialog({
  open,
  role,
  onClose,
  onEdit,
  onDelete,
  onClone,
}: RoleDetailDialogProps): React.ReactElement {
  const { data: permissionsData, isLoading: permissionsLoading } =
    usePermissions();

  const isSystemRole = role?.type === 'system';

  // Group role permissions by category
  const permissionsByCategory = (() => {
    if (!role || !permissionsData) return {};

    const grouped: Record<string, Array<{ name: string; label: string }>> = {};

    // Get metadata for the role's permissions
    for (const permission of role.permissions) {
      const meta = permissionsData.permissions.find(p => p.name === permission);
      const category = meta?.category ?? 'Other';

      grouped[category] ??= [];

      grouped[category].push({
        name: permission,
        label: meta?.label ?? permission,
      });
    }

    return grouped;
  })();

  // Check for wildcard permissions
  const hasFullWildcard = role?.permissions.includes('*');
  const wildcardPermissions =
    role?.permissions.filter(p => p.endsWith(':*')) ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="role-detail-dialog-title"
    >
      <DialogTitle
        id="role-detail-dialog-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {role?.displayName ?? 'Role Details'}
          {isSystemRole && (
            <Tooltip title="System role - cannot be modified">
              <LockIcon fontSize="small" color="action" />
            </Tooltip>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {!role ? (
          <Typography color="text.secondary">No role selected.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Role Info Section */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Role Information
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Name (ID)
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace">
                      {role.name}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Display Name
                    </Typography>
                    <Typography variant="body2">{role.displayName}</Typography>
                  </Box>
                  <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Description
                    </Typography>
                    <Typography variant="body2">
                      {role.description ?? (
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          fontStyle="italic"
                        >
                          No description provided
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={isSystemRole ? 'System Role' : 'Custom Role'}
                    size="small"
                    color={isSystemRole ? 'default' : 'primary'}
                    variant="outlined"
                    {...(isSystemRole && { icon: <LockIcon /> })}
                  />
                  {role.isDefault && (
                    <Chip
                      label="Default Role"
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<StarIcon />}
                    />
                  )}
                  <Chip
                    label={`${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''}`}
                    size="small"
                    variant="outlined"
                  />
                  {role.userCount !== undefined && (
                    <Chip
                      label={`${role.userCount} user${role.userCount !== 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                      color="info"
                    />
                  )}
                </Box>
              </Paper>
            </Box>

            {/* Metadata Section */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Metadata
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(role.createdAt)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(role.updatedAt)}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>

            {/* Permissions Section */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Permissions
              </Typography>

              {permissionsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <>
                  {/* Wildcard Warning */}
                  {hasFullWildcard && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 2,
                        bgcolor: 'warning.50',
                        borderColor: 'warning.main',
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <StarIcon color="warning" fontSize="small" />
                        <Typography variant="body2" fontWeight={600}>
                          Full Access (*)
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        This role has the wildcard (*) permission which grants
                        access to all actions.
                      </Typography>
                    </Paper>
                  )}

                  {/* Resource Wildcards */}
                  {wildcardPermissions.length > 0 && !hasFullWildcard && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 2,
                        bgcolor: 'info.50',
                        borderColor: 'info.main',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        Wildcard Permissions
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {wildcardPermissions.map(p => (
                          <Chip
                            key={p}
                            label={p}
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Paper>
                  )}

                  {/* Permissions by Category */}
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    {Object.entries(permissionsByCategory).map(
                      ([category, perms]) => (
                        <Paper key={category} variant="outlined" sx={{ p: 2 }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            gutterBottom
                          >
                            {category}
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.5,
                            }}
                          >
                            {perms.map(perm => (
                              <Box
                                key={perm.name}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <CheckIcon
                                  fontSize="small"
                                  color="success"
                                  sx={{ fontSize: 16 }}
                                />
                                <Typography variant="body2">
                                  {perm.label}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  fontFamily="monospace"
                                >
                                  ({perm.name})
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Paper>
                      ),
                    )}

                    {Object.keys(permissionsByCategory).length === 0 &&
                      !hasFullWildcard && (
                        <Typography color="text.secondary" variant="body2">
                          No permissions assigned to this role.
                        </Typography>
                      )}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {role && (
          <>
            {/* Clone button - always visible for reference */}
            {onClone && (
              <Tooltip
                title={
                  isSystemRole
                    ? 'Clone this system role to create an editable copy'
                    : 'Clone this role'
                }
              >
                <Button
                  startIcon={<ContentCopyIcon />}
                  onClick={() => onClone(role)}
                  color="inherit"
                >
                  Clone
                </Button>
              </Tooltip>
            )}

            {/* Edit button - disabled for system roles */}
            {onEdit && (
              <Tooltip
                title={
                  isSystemRole ? 'System roles cannot be edited' : 'Edit role'
                }
              >
                <span>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => onEdit(role)}
                    disabled={isSystemRole}
                  >
                    Edit
                  </Button>
                </span>
              </Tooltip>
            )}

            {/* Delete button - disabled for system roles */}
            {onDelete && (
              <Tooltip
                title={
                  isSystemRole
                    ? 'System roles cannot be deleted'
                    : 'Delete role'
                }
              >
                <span>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => onDelete(role)}
                    disabled={isSystemRole}
                    color="error"
                  >
                    Delete
                  </Button>
                </span>
              </Tooltip>
            )}
          </>
        )}

        <Box sx={{ flex: 1 }} />

        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
