/**
 * Office card component.
 * Displays office information with logo and edit/delete/settings actions.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { OfficeLogo } from './OfficeLogo';

import type { LogoInfo } from '../../types/office-settings';
import type { Office } from '../../types/users';

type OfficeCardProps = {
  office: Office;
  /** Logo information for the office */
  logo?: LogoInfo | null;
  /** Whether settings are loading */
  isLoadingSettings?: boolean;
  /** Handler for edit action. If undefined, edit button is hidden. */
  onEdit?: ((office: Office) => void) | undefined;
  /** Handler for delete action. If undefined, delete button is hidden. */
  onDelete?: ((office: Office) => void) | undefined;
  /** Handler for settings action. If undefined, settings button is hidden. */
  onSettings?: ((office: Office) => void) | undefined;
};

/**
 * Card component displaying office information with logo.
 */
export function OfficeCard({
  office,
  logo,
  isLoadingSettings,
  onEdit,
  onDelete,
  onSettings,
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

  const hasActions =
    onEdit !== undefined || onDelete !== undefined || onSettings !== undefined;

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
        {/* Header with Logo */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
            mb: 1,
          }}
        >
          {/* Office Logo */}
          <OfficeLogo
            logo={logo}
            officeName={office.name}
            size={48}
            isLoading={isLoadingSettings}
            useThumbnail
          />

          {/* Name and Status */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h3"
              component="h3"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {office.name}
            </Typography>

            {/* Status Badge */}
            <Chip
              label={office.isActive ? 'Active' : 'Inactive'}
              size="small"
              color={office.isActive ? 'success' : 'default'}
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          </Box>
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
      {hasActions && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          {onSettings && (
            <Tooltip title="Office settings">
              <IconButton
                size="small"
                onClick={e => handleActionClick(e, onSettings)}
                aria-label={`Settings for ${office.name}`}
                data-testid={`settings-office-${office.id}`}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
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
