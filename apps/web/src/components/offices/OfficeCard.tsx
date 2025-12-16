/**
 * Office card component.
 * Displays office information with edit/delete actions.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { Office } from '../../types/users';

type OfficeCardProps = {
  office: Office;
  /** Handler for edit action. If undefined, edit button is hidden. */
  onEdit?: ((office: Office) => void) | undefined;
  /** Handler for delete action. If undefined, delete button is hidden. */
  onDelete?: ((office: Office) => void) | undefined;
};

/**
 * Card component displaying office information.
 */
export function OfficeCard({
  office,
  onEdit,
  onDelete,
}: OfficeCardProps): React.ReactElement {
  /**
   * Handle action button click, stopping propagation.
   */
  function handleActionClick(
    e: React.MouseEvent,
    handler: (office: Office) => void,
  ): void {
    e.stopPropagation();
    handler(office);
  }

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        ...(!office.isActive && {
          borderColor: 'action.disabled',
          bgcolor: 'action.hover',
        }),
      }}
      data-testid={`office-card-${office.id}`}
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
            <Typography variant="h3" component="h3">
              {office.name}
            </Typography>
          </Box>

          {/* Status Badge */}
          <Chip
            label={office.isActive ? 'Active' : 'Inactive'}
            size="small"
            color={office.isActive ? 'success' : 'default'}
            variant="outlined"
          />
        </Box>

        {/* User Count */}
        {office.userCount !== undefined && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'text.secondary',
              mt: 2,
            }}
          >
            <PeopleIcon fontSize="small" />
            <Typography variant="body2">
              {office.userCount} user{office.userCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Action buttons */}
      {(onEdit !== undefined || onDelete !== undefined) && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          {onEdit && (
            <Tooltip title="Edit office">
              <IconButton
                size="small"
                onClick={e => handleActionClick(e, onEdit)}
                aria-label={`Edit ${office.name}`}
                data-testid={`edit-office-${office.id}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete office">
              <IconButton
                size="small"
                onClick={e => handleActionClick(e, onDelete)}
                color="error"
                aria-label={`Delete ${office.name}`}
                data-testid={`delete-office-${office.id}`}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </CardActions>
      )}
    </Card>
  );
}
