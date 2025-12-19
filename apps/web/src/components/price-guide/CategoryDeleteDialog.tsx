/**
 * Category delete confirmation dialog component.
 */
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import type { PriceGuideCategoryListItem } from '@shared/core';

type CategoryDeleteDialogProps = {
  /** Category to delete (null when closed). */
  category: PriceGuideCategoryListItem | null;
  /** Whether the delete operation is in progress. */
  isDeleting?: boolean;
  /** Callback when dialog is closed. */
  onClose: () => void;
  /** Callback when delete is confirmed. */
  onConfirm: (force: boolean) => void;
};

/**
 * Dialog for confirming category deletion.
 * Shows different options when category has children/items.
 */
export function CategoryDeleteDialog({
  category,
  isDeleting = false,
  onClose,
  onConfirm,
}: CategoryDeleteDialogProps): React.ReactElement {
  const open = category !== null;
  const hasChildren = (category?.childCount ?? 0) > 0;
  const hasItems = (category?.itemCount ?? 0) > 0;
  const hasContent = hasChildren || hasItems;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Delete Category
      </DialogTitle>
      <DialogContent>
        {category && (
          <>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete &ldquo;{category.name}&rdquo;?
            </Typography>

            {hasContent && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                  This category has:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {hasChildren && (
                    <li>
                      {category.childCount} subcategor
                      {category.childCount === 1 ? 'y' : 'ies'}
                    </li>
                  )}
                  {hasItems && (
                    <li>
                      {category.itemCount} item
                      {category.itemCount === 1 ? '' : 's'}
                    </li>
                  )}
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Deleting will also remove all subcategories and items.
                </Typography>
              </Alert>
            )}

            {!hasContent && (
              <Typography variant="body2" color="text.secondary">
                This category is empty and can be safely deleted.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(hasContent)}
          variant="contained"
          color="error"
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : hasContent ? 'Delete All' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
