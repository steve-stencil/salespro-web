/**
 * Context menu for category actions.
 * Triggered by right-click or kebab menu button.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import EditIcon from '@mui/icons-material/Edit';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import type { PriceGuideCategoryListItem } from '@shared/core';

type CategoryContextMenuProps = {
  /** Anchor position for the menu. */
  anchorPosition: { x: number; y: number } | null;
  /** Category to show actions for. */
  category: PriceGuideCategoryListItem | null;
  /** Callback when menu is closed. */
  onClose: () => void;
  /** Callback when edit is selected. */
  onEdit: () => void;
  /** Callback when move is selected. */
  onMove: () => void;
  /** Callback when delete is selected. */
  onDelete: () => void;
  /** Whether user can update categories. */
  canUpdate?: boolean;
  /** Whether user can delete categories. */
  canDelete?: boolean;
};

/**
 * Right-click context menu for category actions.
 * Shows edit, move, and delete options based on permissions.
 */
export function CategoryContextMenu({
  anchorPosition,
  category,
  onClose,
  onEdit,
  onMove,
  onDelete,
  canUpdate = true,
  canDelete = true,
}: CategoryContextMenuProps): React.ReactElement {
  const open = anchorPosition !== null && category !== null;

  function handleAction(action: () => void): void {
    onClose();
    action();
  }

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        anchorPosition
          ? { top: anchorPosition.y, left: anchorPosition.x }
          : undefined
      }
    >
      {canUpdate && (
        <MenuItem onClick={() => handleAction(onEdit)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
      )}
      {canUpdate && (
        <MenuItem onClick={() => handleAction(onMove)}>
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move to...</ListItemText>
        </MenuItem>
      )}
      {canDelete && (
        <MenuItem
          onClick={() => handleAction(onDelete)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      )}
    </Menu>
  );
}
