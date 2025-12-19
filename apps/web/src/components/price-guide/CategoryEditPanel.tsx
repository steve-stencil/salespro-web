/**
 * Inline edit panel for category details.
 * Displayed in column 3 when a leaf node is selected.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import SaveIcon from '@mui/icons-material/Save';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

import type { PriceGuideCategoryListItem } from '@shared/core';

type CategoryEditPanelProps = {
  /** Category to edit. */
  category: PriceGuideCategoryListItem;
  /** Callback when category is saved. */
  onSave: (data: { name: string; isActive: boolean }) => Promise<void>;
  /** Callback when delete is requested. */
  onDelete: () => void;
  /** Callback when move is requested. */
  onMove: () => void;
  /** Whether save operation is in progress. */
  isSaving?: boolean;
  /** Whether user can update categories. */
  canUpdate?: boolean;
  /** Whether user can delete categories. */
  canDelete?: boolean;
};

/**
 * Inline panel for editing category properties.
 * Shows a form with name, active status, and action buttons.
 */
export function CategoryEditPanel({
  category,
  onSave,
  onDelete,
  onMove,
  isSaving = false,
  canUpdate = true,
  canDelete = true,
}: CategoryEditPanelProps): React.ReactElement {
  const [name, setName] = useState(category.name);
  const [isActive, setIsActive] = useState(category.isActive);
  const [error, setError] = useState<string | null>(null);

  // Reset form when category changes
  useEffect(() => {
    setName(category.name);
    setIsActive(category.isActive);
    setError(null);
  }, [category.id, category.name, category.isActive]);

  const hasChanges = name !== category.name || isActive !== category.isActive;

  async function handleSave(): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Name must be 100 characters or less');
      return;
    }
    setError(null);
    await onSave({ name: trimmedName, isActive });
  }

  function handleReset(): void {
    setName(category.name);
    setIsActive(category.isActive);
    setError(null);
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'action.hover',
        }}
      >
        <Typography variant="subtitle2" noWrap>
          Edit Category
        </Typography>
      </Box>

      {/* Form */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Editing: <strong>{category.name}</strong>
        </Typography>

        <TextField
          fullWidth
          label="Name"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setError(null);
          }}
          error={!!error}
          helperText={error}
          disabled={!canUpdate || isSaving}
          size="small"
          sx={{ mb: 2 }}
          inputProps={{ maxLength: 100 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              disabled={!canUpdate || isSaving}
            />
          }
          label="Active"
          sx={{ mb: 2 }}
        />

        {/* Metadata */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Created: {new Date(category.createdAt).toLocaleDateString()}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Updated: {new Date(category.updatedAt).toLocaleDateString()}
          </Typography>
          {category.itemCount > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Items: {category.itemCount}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Save/Reset buttons */}
        {canUpdate && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => void handleSave()}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handleReset}
              disabled={!hasChanges || isSaving}
            >
              Reset
            </Button>
          </Box>
        )}

        {/* Action buttons */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {canUpdate && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<DriveFileMoveIcon />}
              onClick={onMove}
              disabled={isSaving}
            >
              Move to...
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onDelete}
              disabled={isSaving}
            >
              Delete
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
