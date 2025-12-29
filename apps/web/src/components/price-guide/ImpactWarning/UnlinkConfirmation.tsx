/**
 * UnlinkConfirmation - Simple confirmation for unlinking items from MSIs.
 */
import LinkOffIcon from '@mui/icons-material/LinkOff';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

export type UnlinkConfirmationProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Name of the item being unlinked */
  itemName: string;
  /** Type of item being unlinked */
  itemType: 'option' | 'upcharge' | 'additionalDetail';
  /** Name of the MSI the item is being unlinked from */
  msiName: string;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Whether the unlink action is loading */
  isLoading?: boolean;
};

/**
 * Simple confirmation dialog for unlinking items from MSIs.
 */
export function UnlinkConfirmation({
  open,
  itemName,
  itemType,
  msiName,
  onCancel,
  onConfirm,
  isLoading = false,
}: UnlinkConfirmationProps): React.ReactElement {
  const itemTypeLabel = (() => {
    switch (itemType) {
      case 'option':
        return 'option';
      case 'upcharge':
        return 'upcharge';
      case 'additionalDetail':
        return 'additional detail';
    }
  })();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby="unlink-confirmation-title"
    >
      <DialogTitle id="unlink-confirmation-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkOffIcon color="action" />
          <Typography component="span" variant="h6">
            Unlink {itemTypeLabel}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          Remove &ldquo;{itemName}&rdquo; from &ldquo;{msiName}&rdquo;?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This will only remove the link. The {itemTypeLabel} will still exist
          in your library and can be linked again later.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={isLoading}>
          {isLoading ? 'Removing...' : 'Unlink'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
