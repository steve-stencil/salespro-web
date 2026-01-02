/**
 * Bulk Delete Dialog Component.
 * Confirms deletion of multiple MSIs.
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
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type BulkDeleteDialogProps = {
  open: boolean;
  selectedIds: string[];
  onClose: () => void;
  onDelete: (ids: string[]) => Promise<BulkDeleteResult>;
};

export type BulkDeleteResult = {
  deleted: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
};

// ============================================================================
// Main Component
// ============================================================================

export function BulkDeleteDialog({
  open,
  selectedIds,
  onClose,
  onDelete,
}: BulkDeleteDialogProps): React.ReactElement {
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkDeleteResult | null>(null);

  const handleClose = useCallback(() => {
    if (isDeleting) return;
    setProgress(0);
    setResult(null);
    onClose();
  }, [isDeleting, onClose]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setProgress(0);
    setResult(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 5, 95));
    }, 100);

    try {
      const deleteResult = await onDelete(selectedIds);
      clearInterval(progressInterval);
      setProgress(100);
      setResult(deleteResult);

      // Auto-close on success after a delay
      if (deleteResult.failed === 0) {
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setResult({
        deleted: 0,
        failed: selectedIds.length,
        errors: [{ id: 'all', error: 'Bulk delete operation failed' }],
      });
      console.error('Bulk delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, onDelete, handleClose]);

  const count = selectedIds.length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="error" />
        Delete {count} Item{count !== 1 ? 's' : ''}
      </DialogTitle>

      <DialogContent>
        {!result ? (
          <>
            <Alert severity="warning" sx={{ mb: 3 }}>
              This action cannot be undone. All selected items and their
              associated pricing data will be permanently deleted.
            </Alert>

            <Typography variant="body1" gutterBottom>
              Are you sure you want to delete{' '}
              <strong>
                {count} item{count !== 1 ? 's' : ''}
              </strong>
              ?
            </Typography>

            {isDeleting && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Deleting items...
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            )}
          </>
        ) : (
          <>
            {result.failed === 0 ? (
              <Alert severity="success">
                Successfully deleted {result.deleted} item
                {result.deleted !== 1 ? 's' : ''}.
              </Alert>
            ) : (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Deleted {result.deleted} item{result.deleted !== 1 ? 's' : ''}
                  . Failed to delete {result.failed} item
                  {result.failed !== 1 ? 's' : ''}.
                </Alert>

                {result.errors.length > 0 && (
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Errors:
                    </Typography>
                    {result.errors.slice(0, 5).map((err, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        color="error"
                        sx={{ mb: 0.5 }}
                      >
                        • {err.error}
                      </Typography>
                    ))}
                    {result.errors.length > 5 && (
                      <Typography variant="body2" color="text.secondary">
                        ...and {result.errors.length - 5} more errors
                      </Typography>
                    )}
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              startIcon={
                isDeleting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {isDeleting
                ? 'Deleting...'
                : `Delete ${count} Item${count !== 1 ? 's' : ''}`}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
