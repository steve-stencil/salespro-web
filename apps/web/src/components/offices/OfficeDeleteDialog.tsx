/**
 * Office delete confirmation dialog.
 * Shows warning if users are assigned and confirms deletion.
 */
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import type { Office } from '../../types/users';

type OfficeDeleteDialogProps = {
  office: Office | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Dialog for confirming office deletion with user warning.
 */
export function OfficeDeleteDialog({
  office,
  isDeleting,
  onClose,
  onConfirm,
}: OfficeDeleteDialogProps): React.ReactElement {
  const hasUsers = office && (office.userCount ?? 0) > 0;

  return (
    <Dialog
      open={office !== null}
      onClose={onClose}
      aria-labelledby="delete-dialog-title"
    >
      <DialogTitle id="delete-dialog-title">Delete Office</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the office &quot;{office?.name}&quot;?
          This action cannot be undone.
        </DialogContentText>
        {hasUsers && (
          <DialogContentText sx={{ mt: 2, color: 'warning.main' }}>
            Warning: This office has {office.userCount} user
            {office.userCount !== 1 ? 's' : ''} assigned. They will lose access
            to this office.
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isDeleting}
          startIcon={
            isDeleting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
