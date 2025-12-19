/**
 * Logo card component for displaying a logo in the library.
 * Shows thumbnail, name, usage info, and action buttons.
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { CompanyLogoLibraryItem } from '../../types/company';

type LogoCardProps = {
  /** Logo item from the library */
  logo: CompanyLogoLibraryItem;
  /** Whether this logo is currently selected (in picker mode) */
  isSelected?: boolean;
  /** Handler for selecting this logo (picker mode) */
  onSelect?: (logo: CompanyLogoLibraryItem) => void;
  /** Handler for editing the logo name */
  onEdit?: (logo: CompanyLogoLibraryItem) => void;
  /** Handler for setting as default */
  onSetDefault?: (logo: CompanyLogoLibraryItem) => void;
  /** Handler for deleting the logo */
  onDelete?: (logo: CompanyLogoLibraryItem) => void;
  /** Whether actions are disabled */
  disabled?: boolean;
};

/**
 * Card component for displaying a logo in the company library.
 */
export function LogoCard({
  logo,
  isSelected = false,
  onSelect,
  onEdit,
  onSetDefault,
  onDelete,
  disabled = false,
}: LogoCardProps): React.ReactElement {
  const hasActions = onEdit ?? onSetDefault ?? onDelete;
  const isClickable = !!onSelect;

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderWidth: isSelected ? 2 : 1,
        bgcolor: isSelected ? 'primary.50' : 'background.paper',
        '&:hover': isClickable
          ? {
              borderColor: 'primary.main',
              boxShadow: 1,
            }
          : undefined,
      }}
      onClick={isClickable && !disabled ? () => onSelect(logo) : undefined}
      data-testid={`logo-card-${logo.id}`}
    >
      {/* Default badge */}
      {logo.isDefault && (
        <Chip
          icon={<StarIcon sx={{ fontSize: 16 }} />}
          label="Default"
          size="small"
          color="primary"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 1,
          }}
        />
      )}

      {/* Selected indicator */}
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
          }}
        >
          <CheckCircleIcon color="primary" />
        </Box>
      )}

      {/* Logo image */}
      <CardMedia
        component="img"
        height="120"
        image={logo.thumbnailUrl ?? logo.url}
        alt={logo.name}
        sx={{
          objectFit: 'contain',
          bgcolor: 'grey.50',
          p: 2,
        }}
      />

      {/* Logo info */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          noWrap
          title={logo.name}
          sx={{ mb: 0.5 }}
        >
          {logo.name}
        </Typography>

        {logo.usedByOfficeCount > 0 && (
          <Typography variant="caption" color="text.secondary">
            Used by {logo.usedByOfficeCount} office
            {logo.usedByOfficeCount !== 1 ? 's' : ''}
          </Typography>
        )}
      </Box>

      {/* Actions (only in management mode, not picker) */}
      {hasActions && !onSelect && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          {onEdit && (
            <Tooltip title="Edit name">
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  onEdit(logo);
                }}
                disabled={disabled}
                data-testid={`edit-logo-${logo.id}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {onSetDefault && !logo.isDefault && (
            <Tooltip title="Set as default">
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  onSetDefault(logo);
                }}
                disabled={disabled}
                color="primary"
                data-testid={`set-default-logo-${logo.id}`}
              >
                <StarIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {onDelete && (
            <Tooltip
              title={
                logo.isDefault
                  ? 'Cannot delete default logo'
                  : logo.usedByOfficeCount > 0
                    ? 'Cannot delete logo used by offices'
                    : 'Delete logo'
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={e => {
                    e.stopPropagation();
                    onDelete(logo);
                  }}
                  disabled={
                    disabled || logo.isDefault || logo.usedByOfficeCount > 0
                  }
                  color="error"
                  data-testid={`delete-logo-${logo.id}`}
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
