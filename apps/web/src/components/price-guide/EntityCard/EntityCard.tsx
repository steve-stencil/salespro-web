/**
 * EntityCard component - Reusable expandable card for MSIs, Options, UpCharges.
 * Used in catalog list views and expanded detail sections.
 */
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

import type { ReactNode, MouseEvent } from 'react';

/** Entity types supported by EntityCard */
export type EntityType = 'msi' | 'option' | 'upcharge' | 'additionalDetail';

/** Menu action definition */
export type MenuAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  dividerBefore?: boolean;
  color?: 'error' | 'inherit';
};

/** Props for EntityCard component */
export type EntityCardProps = {
  /** Entity type for styling and behavior */
  entityType: EntityType;
  /** Primary name/title of the entity */
  name: string;
  /** Secondary text (e.g., category path, brand) */
  subtitle?: string;
  /** Whether the card is expanded */
  isExpanded?: boolean;
  /** Callback when expand toggle is clicked */
  onToggleExpand?: () => void;
  /** Whether the card is selected (for bulk operations) */
  isSelected?: boolean;
  /** Callback when selection checkbox is toggled */
  onToggleSelect?: () => void;
  /** Show selection checkbox */
  showCheckbox?: boolean;
  /** Show expand toggle */
  showExpand?: boolean;
  /** Badges to show in the header row */
  badges?: ReactNode;
  /** Content to show when expanded */
  expandedContent?: ReactNode;
  /** Menu actions for the overflow menu */
  menuActions?: MenuAction[];
  /** Primary click action (clicking on name/title) */
  onClick?: () => void;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
  /** Additional class name */
  className?: string;
};

/**
 * Reusable entity card component for price guide items.
 * Supports expand/collapse, selection, and overflow menu.
 */
export function EntityCard({
  entityType: _entityType,
  name,
  subtitle,
  isExpanded = false,
  onToggleExpand,
  isSelected = false,
  onToggleSelect,
  showCheckbox = true,
  showExpand = true,
  badges,
  expandedContent,
  menuActions,
  onClick,
  isLoading = false,
  className,
}: EntityCardProps): React.ReactElement {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleMenuAction = useCallback(
    (action: MenuAction) => {
      handleMenuClose();
      action.onClick();
    },
    [handleMenuClose],
  );

  const handleCheckboxClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onToggleSelect?.();
    },
    [onToggleSelect],
  );

  const handleExpandClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onToggleExpand?.();
    },
    [onToggleExpand],
  );

  const handleNameClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  return (
    <Card
      className={className}
      sx={{
        mb: 1,
        bgcolor: isSelected ? 'action.selected' : undefined,
        '&:hover': {
          bgcolor: isSelected ? 'action.selected' : 'action.hover',
        },
        transition: 'background-color 0.2s',
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        {/* Main Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Checkbox */}
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelect?.()}
              onClick={handleCheckboxClick}
              size="small"
              disabled={isLoading}
            />
          )}

          {/* Expand Icon */}
          {showExpand && (
            <IconButton
              size="small"
              onClick={handleExpandClick}
              disabled={isLoading}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}

          {/* Name & Subtitle - Clickable */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              cursor: onClick ? 'pointer' : 'default',
            }}
            onClick={handleNameClick}
          >
            <Typography
              variant="subtitle1"
              noWrap
              fontWeight={500}
              color={onClick ? 'primary.main' : 'text.primary'}
              sx={
                onClick
                  ? { '&:hover': { textDecoration: 'underline' } }
                  : undefined
              }
            >
              {name}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Badges */}
          {badges && (
            <Stack direction="row" spacing={1} alignItems="center">
              {badges}
            </Stack>
          )}

          {/* Overflow Menu */}
          {menuActions && menuActions.length > 0 && (
            <>
              <IconButton
                size="small"
                onClick={handleMenuOpen}
                disabled={isLoading}
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={menuOpen ? 'true' : undefined}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {menuActions.map((action, index) => (
                  <MenuItem
                    key={action.label}
                    onClick={() => handleMenuAction(action)}
                    disabled={action.disabled}
                    sx={{
                      color:
                        action.color === 'error' ? 'error.main' : undefined,
                      ...(action.dividerBefore && index > 0
                        ? {
                            borderTop: 1,
                            borderColor: 'divider',
                            mt: 0.5,
                            pt: 1,
                          }
                        : {}),
                    }}
                  >
                    {action.icon && (
                      <Box component="span" sx={{ mr: 1, display: 'flex' }}>
                        {action.icon}
                      </Box>
                    )}
                    {action.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </Box>

        {/* Expanded Content */}
        {showExpand && expandedContent && (
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              {expandedContent}
            </Box>
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
}
