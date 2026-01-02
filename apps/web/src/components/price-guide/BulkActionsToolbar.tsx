/**
 * Bulk Actions Toolbar Component.
 * Displays actions for selected items in the catalog.
 */

import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type BulkActionsToolbarProps = {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkEdit: () => void;
  onExport: () => void;
};

// ============================================================================
// Main Component
// ============================================================================

export function BulkActionsToolbar({
  selectedCount,
  totalCount,
  allSelected,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkEdit,
  onExport,
}: BulkActionsToolbarProps): React.ReactElement | null {
  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [allSelected, onSelectAll, onDeselectAll]);

  // Don't show if nothing selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        px: 3,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderRadius: 2,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
      }}
    >
      {/* Select All Toggle */}
      <Tooltip title={allSelected ? 'Deselect all' : 'Select all visible'}>
        <IconButton
          size="small"
          onClick={handleToggleAll}
          sx={{ color: 'inherit' }}
        >
          {allSelected ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
        </IconButton>
      </Tooltip>

      {/* Selection Count */}
      <Typography variant="body2" fontWeight={500}>
        {selectedCount} of {totalCount} selected
      </Typography>

      {/* Divider */}
      <Box
        sx={{
          width: 1,
          height: 24,
          bgcolor: 'rgba(255,255,255,0.3)',
          mx: 1,
        }}
      />

      {/* Actions */}
      <Button
        size="small"
        variant="text"
        startIcon={<EditIcon />}
        onClick={onBulkEdit}
        sx={{ color: 'inherit' }}
      >
        Edit
      </Button>

      <Button
        size="small"
        variant="text"
        startIcon={<DownloadIcon />}
        onClick={onExport}
        sx={{ color: 'inherit' }}
      >
        Export
      </Button>

      <Button
        size="small"
        variant="text"
        startIcon={<DeleteIcon />}
        onClick={onBulkDelete}
        sx={{ color: 'inherit' }}
      >
        Delete
      </Button>

      {/* Divider */}
      <Box
        sx={{
          width: 1,
          height: 24,
          bgcolor: 'rgba(255,255,255,0.3)',
          mx: 1,
        }}
      />

      {/* Close */}
      <Tooltip title="Clear selection">
        <IconButton
          size="small"
          onClick={onDeselectAll}
          sx={{ color: 'inherit' }}
        >
          <CloseIcon />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
