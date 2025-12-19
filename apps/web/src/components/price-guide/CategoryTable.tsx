/**
 * Category table component for displaying categories in table view.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { InlineEditInput } from './InlineEditInput';

import type { PriceGuideCategoryListItem } from '@shared/core';

type CategoryTableProps = {
  /** Categories to display. */
  categories: PriceGuideCategoryListItem[];
  /** Whether data is loading. */
  isLoading?: boolean;
  /** Callback when a category row is clicked. */
  onCategoryClick: (categoryId: string) => void;
  /** Callback when a category name is renamed. */
  onRename: (categoryId: string, newName: string) => void;
  /** Callback when Edit button is clicked. */
  onEdit: (category: PriceGuideCategoryListItem) => void;
  /** Callback when Move button is clicked. */
  onMove: (category: PriceGuideCategoryListItem) => void;
  /** Callback when Delete button is clicked. */
  onDelete: (category: PriceGuideCategoryListItem) => void;
  /** Whether actions are disabled. */
  actionsDisabled?: boolean;
  /** Empty state message. */
  emptyMessage?: string;
};

/**
 * Skeleton row for loading state.
 */
function CategoryRowSkeleton(): React.ReactElement {
  return (
    <TableRow>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width={150} />
        </Box>
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width={60} />
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width={100} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={80} height={24} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Format date for display.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Table view for displaying category list.
 */
export function CategoryTable({
  categories,
  isLoading = false,
  onCategoryClick,
  onRename,
  onEdit,
  onMove,
  onDelete,
  actionsDisabled = false,
  emptyMessage = 'No categories found.',
}: CategoryTableProps): React.ReactElement {
  if (isLoading) {
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[1, 2, 3, 4, 5].map(i => (
              <CategoryRowSkeleton key={i} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  if (categories.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 2,
          backgroundColor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Items</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {categories.map(category => (
            <TableRow
              key={category.id}
              hover
              onClick={() => onCategoryClick(category.id)}
              sx={{
                cursor: 'pointer',
                opacity: category.isActive ? 1 : 0.6,
              }}
            >
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon
                    fontSize="small"
                    color={category.isActive ? 'primary' : 'disabled'}
                  />
                  <Box onClick={e => e.stopPropagation()}>
                    <InlineEditInput
                      value={category.name}
                      onSave={newName => onRename(category.id, newName)}
                      disabled={actionsDisabled}
                    />
                  </Box>
                  {!category.isActive && (
                    <Chip label="Inactive" size="small" variant="outlined" />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {category.childCount > 0 && (
                    <Chip
                      label={`${category.childCount} sub`}
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
                  {category.childCount === 0 && category.itemCount === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Empty
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {formatDate(category.createdAt)}
                </Typography>
              </TableCell>
              <TableCell align="right" onClick={e => e.stopPropagation()}>
                {!actionsDisabled && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 0.5,
                    }}
                  >
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => onEdit(category)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Move to...">
                      <IconButton size="small" onClick={() => onMove(category)}>
                        <DriveFileMoveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => onDelete(category)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
