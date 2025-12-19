/**
 * Category card component for grid view display.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { InlineEditInput } from './InlineEditInput';

import type { PriceGuideCategoryListItem } from '@shared/core';

type CategoryCardProps = {
  /** Category data to display. */
  category: PriceGuideCategoryListItem;
  /** Callback when card is clicked (navigate into category). */
  onClick: (categoryId: string) => void;
  /** Callback when name is edited inline. */
  onRename: (categoryId: string, newName: string) => void;
  /** Callback when Edit menu item is clicked. */
  onEdit: (category: PriceGuideCategoryListItem) => void;
  /** Callback when Move menu item is clicked. */
  onMove: (category: PriceGuideCategoryListItem) => void;
  /** Callback when Delete menu item is clicked. */
  onDelete: (category: PriceGuideCategoryListItem) => void;
  /** Whether actions are disabled (e.g., user lacks permission). */
  actionsDisabled?: boolean;
};

/**
 * Card component displaying a price guide category.
 * Click to navigate, double-click name to edit, kebab menu for actions.
 */
export function CategoryCard({
  category,
  onClick,
  onRename,
  onEdit,
  onMove,
  onDelete,
  actionsDisabled = false,
}: CategoryCardProps): React.ReactElement {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);

  function handleMenuClick(event: React.MouseEvent<HTMLElement>): void {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  }

  function handleMenuClose(): void {
    setMenuAnchor(null);
  }

  function handleAction(action: () => void): void {
    handleMenuClose();
    action();
  }

  const totalItems = category.itemCount + category.childCount;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        opacity: category.isActive ? 1 : 0.6,
      }}
    >
      {/* Menu button - positioned absolutely */}
      {!actionsDisabled && (
        <IconButton
          aria-label="Category actions"
          aria-controls={menuOpen ? 'category-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={handleMenuClick}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 1,
          }}
          size="small"
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}

      <CardActionArea
        onClick={() => onClick(category.id)}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <CardContent sx={{ flex: 1, pt: 3 }}>
          {/* Folder icon with badge */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Badge
              badgeContent={totalItems > 0 ? totalItems : null}
              color="primary"
              max={999}
            >
              <FolderIcon
                sx={{
                  fontSize: 64,
                  color: category.isActive ? 'primary.main' : 'text.disabled',
                }}
              />
            </Badge>
          </Box>

          {/* Category name (inline editable) */}
          <Box onClick={e => e.stopPropagation()} sx={{ textAlign: 'center' }}>
            <InlineEditInput
              value={category.name}
              onSave={newName => onRename(category.id, newName)}
              variant="subtitle1"
              disabled={actionsDisabled}
            />
          </Box>

          {/* Metadata */}
          <Box
            sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}
          >
            {category.childCount > 0 && (
              <Chip
                label={`${category.childCount} subcategories`}
                size="small"
                variant="outlined"
              />
            )}
            {category.itemCount > 0 && (
              <Chip
                label={`${category.itemCount} items`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          {/* Inactive indicator */}
          {!category.isActive && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 1 }}
            >
              (Inactive)
            </Typography>
          )}
        </CardContent>
      </CardActionArea>

      {/* Actions menu */}
      <Menu
        id="category-menu"
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        onClick={e => e.stopPropagation()}
      >
        <MenuItem onClick={() => handleAction(() => onEdit(category))}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction(() => onMove(category))}>
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move to...</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleAction(() => onDelete(category))}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
}
