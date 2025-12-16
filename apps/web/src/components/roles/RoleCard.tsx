/**
 * Role card component.
 * Displays role information with edit/delete actions.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { Role } from '../../types/users';

interface RoleCardProps {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

/**
 * Card component displaying role information.
 */
export function RoleCard({
  role,
  onEdit,
  onDelete,
}: RoleCardProps): React.ReactElement {
  const isSystemRole = role.type === 'system';

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...(isSystemRole && {
          borderColor: 'action.disabled',
          bgcolor: 'action.hover',
        }),
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <Typography variant="h3" component="h3">
                {role.displayName}
              </Typography>
              {isSystemRole && (
                <Tooltip title="System role - cannot be modified">
                  <LockIcon fontSize="small" color="action" />
                </Tooltip>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {role.name}
            </Typography>
          </Box>

          {/* Badges */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isSystemRole && (
              <Chip
                label="System"
                size="small"
                color="default"
                variant="outlined"
              />
            )}
            {role.isDefault && (
              <Chip
                label="Default"
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            minHeight: 40,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {role.description ?? 'No description provided.'}
        </Typography>

        {/* Permission count */}
        <Typography variant="body2">
          <strong>{role.permissions.length}</strong> permission
          {role.permissions.length !== 1 ? 's' : ''}
        </Typography>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Tooltip
          title={isSystemRole ? 'Cannot edit system roles' : 'Edit role'}
        >
          <span>
            <IconButton
              size="small"
              onClick={() => onEdit(role)}
              disabled={isSystemRole}
              aria-label={`Edit ${role.displayName}`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip
          title={isSystemRole ? 'Cannot delete system roles' : 'Delete role'}
        >
          <span>
            <IconButton
              size="small"
              onClick={() => onDelete(role)}
              disabled={isSystemRole}
              color="error"
              aria-label={`Delete ${role.displayName}`}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
