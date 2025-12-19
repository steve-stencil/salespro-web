/**
 * Category create/edit dialog component.
 */
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';

import type { PriceGuideCategoryListItem } from '@shared/core';

type CategoryEditDialogProps = {
  /** Whether the dialog is open. */
  open: boolean;
  /** Category to edit (null for create mode). */
  category: PriceGuideCategoryListItem | null;
  /** Parent category ID when creating a child (null for root). */
  parentId?: string | null;
  /** Whether the save operation is in progress. */
  isSaving?: boolean;
  /** Callback when dialog is closed. */
  onClose: () => void;
  /** Callback when category is saved. */
  onSave: (data: { name: string; isActive: boolean }) => void;
};

/**
 * Dialog for creating or editing a price guide category.
 */
export function CategoryEditDialog({
  open,
  category,
  isSaving = false,
  onClose,
  onSave,
}: CategoryEditDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const isEdit = category !== null;
  const title = isEdit ? 'Edit Category' : 'Create Category';

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setIsActive(category.isActive);
      } else {
        setName('');
        setIsActive(true);
      }
      setNameError(null);
    }
  }, [open, category]);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Name is required');
      return;
    }
    if (trimmedName.length > 100) {
      setNameError('Name must be 100 characters or less');
      return;
    }

    onSave({ name: trimmedName, isActive });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ component: 'form', onSubmit: handleSubmit }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          required
          margin="dense"
          id="category-name"
          name="name"
          label="Category Name"
          type="text"
          fullWidth
          variant="outlined"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setNameError(null);
          }}
          error={!!nameError}
          helperText={nameError ?? 'Enter a name for this category'}
          inputProps={{ maxLength: 100 }}
          sx={{ mt: 1 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
            />
          }
          label="Active"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
