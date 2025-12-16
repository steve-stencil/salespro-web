/**
 * Role card component.
 * Displays role information with edit/delete actions.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { Role } from '../../types/users';

interface RoleCardProps {
  role: Role;
  /** Handler for click action (view details). */
  onClick?: ((role: Role) => void) | undefined;
  /** Handler for edit action. If undefined, edit button is hidden. */
  onEdit?: ((role: Role) => void) | undefined;
  /** Handler for delete action. If undefined, delete button is hidden. */
  onDelete?: ((role: Role) => void) | undefined;
}

/**
 * Card component displaying role information.
 */
export function RoleCard({
  role,
  onClick,
  onEdit,
  onDelete,
}: RoleCardProps): React.ReactElement {
  const isSystemRole = role.type === 'system';

  // Get preview of permissions (first 3)
  const previewPermissions = role.permissions.slice(0, 3);
  const remainingCount = Math.max(0, role.permissions.length - 3);
  const hasWildcard = role.permissions.includes('*');

  /**
   * Handle card click, preventing event propagation from action buttons.
   */
  function handleCardClick(): void {
    if (onClick) {
      onClick(role);
    }
  }

  /**
   * Handle action button click, stopping propagation to prevent card click.
   */
  function handleActionClick(
    e: React.MouseEvent,
    handler: (role: Role) => void,
  ): void {
    e.stopPropagation();
    handler(role);
  }

  const cardContent = (
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
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
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
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

      {/* Permission Preview */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {role.permissions.length} permission
          {role.permissions.length !== 1 ? 's' : ''}
        </Typography>
        {hasWildcard ? (
          <Chip
            label="Full Access (*)"
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {previewPermissions.map(perm => (
              <Chip
                key={perm}
                label={perm}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
            {remainingCount > 0 && (
              <Chip
                label={`+${remainingCount} more`}
                size="small"
                color="default"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
        )}
      </Box>
    </CardContent>
  );

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        ...(isSystemRole && {
          borderColor: 'action.disabled',
          bgcolor: 'action.hover',
        }),
        ...(onClick && {
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: 1,
          },
        }),
      }}
      data-testid={`role-card-${role.name}`}
    >
      {/* Clickable area */}
      {onClick ? (
        <CardActionArea
          onClick={handleCardClick}
          sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
          aria-label={`View details for ${role.displayName}`}
        >
          {cardContent}
        </CardActionArea>
      ) : (
        cardContent
      )}

      {/* Action buttons - always visible outside clickable area */}
      {(onClick || onEdit || onDelete) && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          {onClick && (
            <Tooltip title="View details">
              <IconButton
                size="small"
                onClick={e => handleActionClick(e, onClick)}
                aria-label={`View ${role.displayName} details`}
                data-testid={`view-role-${role.name}`}
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip
              title={isSystemRole ? 'Cannot edit system roles' : 'Edit role'}
            >
              <span>
                <IconButton
                  size="small"
                  onClick={e =>
                    !isSystemRole && handleActionClick(e, onEdit)
                  }
                  disabled={isSystemRole}
                  aria-label={`Edit ${role.displayName}`}
                  data-testid={`edit-role-${role.name}`}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip
              title={
                isSystemRole ? 'Cannot delete system roles' : 'Delete role'
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={e =>
                    !isSystemRole && handleActionClick(e, onDelete)
                  }
                  disabled={isSystemRole}
                  color="error"
                  aria-label={`Delete ${role.displayName}`}
                  data-testid={`delete-role-${role.name}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </CardActions>
      )}
    </Card>
  );
}
