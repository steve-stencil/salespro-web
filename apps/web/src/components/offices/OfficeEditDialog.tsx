/**
 * Office edit/create dialog component.
 * Provides form for creating or editing offices.
 */
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useState, useEffect } from 'react';

import { useCreateOffice, useUpdateOffice } from '../../hooks/useOffices';
import { handleApiError } from '../../lib/api-client';

import type { Office, CreateOfficeRequest } from '../../types/users';

interface OfficeEditDialogProps {
  open: boolean;
  office?: Office | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Dialog for creating or editing an office.
 */
export function OfficeEditDialog({
  open,
  office,
  onClose,
  onSaved,
}: OfficeEditDialogProps): React.ReactElement {
  const isEditing = !!office;

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
  }>({});

  const createOfficeMutation = useCreateOffice();
  const updateOfficeMutation = useUpdateOffice();

  // Initialize form when office changes
  useEffect(() => {
    if (office) {
      // Editing existing office
      setName(office.name);
      setIsActive(office.isActive);
    } else {
      // Creating new office
      setName('');
      setIsActive(true);
    }
    setError(null);
    setValidationErrors({});
  }, [office, open]);

  /**
   * Validate form fields.
   */
  function validate(): boolean {
    const errors: typeof validationErrors = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    } else if (name.length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Handle form submission.
   */
  async function handleSubmit(): Promise<void> {
    if (!validate()) return;

    setError(null);

    try {
      if (office) {
        await updateOfficeMutation.mutateAsync({
          officeId: office.id,
          data: {
            name,
            isActive,
          },
        });
      } else {
        const createData: CreateOfficeRequest = {
          name,
          isActive,
        };
        await createOfficeMutation.mutateAsync(createData);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  const isLoading =
    createOfficeMutation.isPending || updateOfficeMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          {office ? `Edit Office: ${office.name}` : 'Create New Office'}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Office Name"
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (validationErrors.name) {
                setValidationErrors(prev => ({ ...prev, name: undefined }));
              }
            }}
            error={!!validationErrors.name}
            helperText={
              validationErrors.name ?? 'Enter a unique name for this office'
            }
            fullWidth
            autoFocus
          />

          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
            }
            label="Office is active"
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isLoading}
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {isEditing ? 'Save Changes' : 'Create Office'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
