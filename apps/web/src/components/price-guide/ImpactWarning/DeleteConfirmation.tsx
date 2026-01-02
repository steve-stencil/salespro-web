/**
 * DeleteConfirmation - Confirmation dialog for deleting shared items.
 * Requires typing "delete" to confirm when item is in use.
 */
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useEffect } from 'react';

import type { AffectedItem } from './EditImpactWarning';

export type DeleteConfirmationProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Name of the item being deleted */
  itemName: string;
  /** Type of item being deleted */
  itemType: 'msi' | 'option' | 'upcharge' | 'additionalDetail' | 'category';
  /** List of MSIs that will be affected (for options/upcharges) */
  affectedMSIs?: AffectedItem[];
  /** Maximum number of items to show in the list */
  maxDisplayed?: number;
  /** Whether to require typing "delete" to confirm */
  requireConfirmation?: boolean;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Whether the delete action is loading */
  isLoading?: boolean;
};

const CONFIRM_TEXT = 'delete';

/**
 * Confirmation dialog for deleting items.
 * For items in use, requires typing "delete" to confirm.
 */
export function DeleteConfirmation({
  open,
  itemName,
  itemType,
  affectedMSIs = [],
  maxDisplayed = 5,
  requireConfirmation,
  onCancel,
  onConfirm,
  isLoading = false,
}: DeleteConfirmationProps): React.ReactElement {
  const [confirmText, setConfirmText] = useState('');

  // Reset confirm text when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmText('');
    }
  }, [open]);

  const hasAffectedItems = affectedMSIs.length > 0;
  const shouldRequireConfirmation = requireConfirmation ?? hasAffectedItems;
  const isConfirmValid =
    !shouldRequireConfirmation || confirmText.toLowerCase() === CONFIRM_TEXT;

  const displayedMSIs = affectedMSIs.slice(0, maxDisplayed);
  const remainingCount = affectedMSIs.length - maxDisplayed;

  const itemTypeLabel = (() => {
    switch (itemType) {
      case 'msi':
        return 'measure sheet item';
      case 'option':
        return 'option';
      case 'upcharge':
        return 'upcharge';
      case 'additionalDetail':
        return 'additional detail field';
      case 'category':
        return 'category';
    }
  })();

  const handleConfirm = useCallback(() => {
    if (isConfirmValid) {
      onConfirm();
    }
  }, [isConfirmValid, onConfirm]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-confirmation-title"
    >
      <DialogTitle id="delete-confirmation-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="error" />
          <Typography component="span" variant="h6">
            Confirm Delete
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete &ldquo;{itemName}&rdquo;?
        </Typography>

        {hasAffectedItems && (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              This {itemTypeLabel} is used in {affectedMSIs.length} measure
              sheet item{affectedMSIs.length !== 1 ? 's' : ''}. Deleting it
              will:
            </Typography>
            <List
              dense
              sx={{ bgcolor: 'action.hover', borderRadius: 1, my: 1 }}
            >
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText
                  primary="• Remove it from all MSIs that reference it"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText
                  primary="• Delete all associated pricing data"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Affected items:
            </Typography>
            <List dense>
              {displayedMSIs.map(msi => (
                <ListItem key={msi.id} sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={`• ${msi.name}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
              {remainingCount > 0 && (
                <ListItem sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={`• ...and ${remainingCount} more`}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                    }}
                  />
                </ListItem>
              )}
            </List>
          </>
        )}

        <Alert severity="warning" sx={{ my: 2 }}>
          This action cannot be undone.
        </Alert>

        {shouldRequireConfirmation && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Type <strong>{CONFIRM_TEXT}</strong> to confirm:
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={CONFIRM_TEXT}
              disabled={isLoading}
              onKeyDown={e => {
                if (e.key === 'Enter' && isConfirmValid) {
                  handleConfirm();
                }
              }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={isLoading || !isConfirmValid}
        >
          {isLoading ? 'Deleting...' : 'Delete Permanently'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
