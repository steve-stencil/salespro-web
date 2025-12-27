/**
 * Delete MSI Confirmation Dialog.
 * Shows impact and confirms deletion.
 */

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

import { useDeleteMsi } from '../../hooks/usePriceGuide';

// ============================================================================
// Types
// ============================================================================

type DeleteMsiDialogProps = {
  open: boolean;
  msiId: string;
  msiName: string;
  onClose: () => void;
  onSuccess: () => void;
};

// ============================================================================
// Main Component
// ============================================================================

export function DeleteMsiDialog({
  open,
  msiId,
  msiName,
  onClose,
  onSuccess,
}: DeleteMsiDialogProps): React.ReactElement {
  const [confirmText, setConfirmText] = useState('');
  const deleteMutation = useDeleteMsi();

  const isConfirmValid = confirmText === msiName;

  const handleDelete = useCallback(async () => {
    if (!isConfirmValid) return;

    try {
      await deleteMutation.mutateAsync(msiId);
      setConfirmText('');
      onSuccess();
    } catch (error) {
      console.error('Failed to delete MSI:', error);
    }
  }, [msiId, isConfirmValid, deleteMutation, onSuccess]);

  const handleClose = useCallback(() => {
    if (deleteMutation.isPending) return;
    setConfirmText('');
    onClose();
  }, [deleteMutation.isPending, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="error" />
        Delete Measure Sheet Item
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          This action cannot be undone. The item will be permanently deleted
          along with all associated pricing data.
        </Alert>

        <Typography variant="body1" gutterBottom>
          You are about to delete:
        </Typography>
        <Box
          sx={{
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
            mb: 3,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {msiName}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          To confirm deletion, type the item name exactly as shown above:
        </Typography>

        <TextField
          fullWidth
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={msiName}
          error={confirmText.length > 0 && !isConfirmValid}
          helperText={
            confirmText.length > 0 && !isConfirmValid
              ? 'Text does not match the item name'
              : undefined
          }
          disabled={deleteMutation.isPending}
        />

        {deleteMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to delete the item. Please try again.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={deleteMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => void handleDelete()}
          disabled={!isConfirmValid || deleteMutation.isPending}
          startIcon={
            deleteMutation.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
