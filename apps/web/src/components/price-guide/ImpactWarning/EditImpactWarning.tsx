/**
 * EditImpactWarning - Warning dialog shown before editing shared items.
 */
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

export type AffectedItem = {
  id: string;
  name: string;
};

export type EditImpactWarningProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Name of the item being edited */
  itemName: string;
  /** Type of item being edited */
  itemType: 'option' | 'upcharge' | 'additionalDetail';
  /** List of MSIs that will be affected */
  affectedMSIs: AffectedItem[];
  /** Maximum number of MSIs to show in the list */
  maxDisplayed?: number;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Whether the confirm action is loading */
  isLoading?: boolean;
};

/**
 * Warning dialog shown before editing shared items.
 * Displays list of MSIs that will be affected by the change.
 */
export function EditImpactWarning({
  open,
  itemName,
  itemType,
  affectedMSIs,
  maxDisplayed = 5,
  onCancel,
  onConfirm,
  isLoading = false,
}: EditImpactWarningProps): React.ReactElement {
  const itemTypeLabel = (() => {
    switch (itemType) {
      case 'option':
        return 'option';
      case 'upcharge':
        return 'upcharge';
      case 'additionalDetail':
        return 'additional detail field';
    }
  })();

  const displayedMSIs = affectedMSIs.slice(0, maxDisplayed);
  const remainingCount = affectedMSIs.length - maxDisplayed;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="edit-impact-warning-title"
    >
      <DialogTitle id="edit-impact-warning-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          <Typography component="span" variant="h6">
            This Change Will Affect Multiple Items
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          &ldquo;{itemName}&rdquo; is used in {affectedMSIs.length} measure
          sheet item{affectedMSIs.length !== 1 ? 's' : ''}.
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Any changes you make to this {itemTypeLabel} will appear everywhere it
          is used:
        </Typography>
        <List dense>
          {displayedMSIs.map(msi => (
            <ListItem key={msi.id} sx={{ py: 0.5 }}>
              <ListItemText
                primary={`• ${msi.name}`}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          ))}
          {remainingCount > 0 && (
            <ListItem sx={{ py: 0.5 }}>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'I Understand, Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
