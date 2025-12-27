/**
 * Where Used Modal Component.
 * Shows which MSIs are using a shared item (Option, UpCharge, or Additional Detail).
 */

import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import { useOptionDetail, useUpchargeDetail } from '../../hooks/usePriceGuide';

// ============================================================================
// Types
// ============================================================================

type ItemType = 'option' | 'upcharge' | 'additional-detail';

type WhereUsedModalProps = {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemType: ItemType;
  itemName: string;
};

// ============================================================================
// Main Component
// ============================================================================

export function WhereUsedModal({
  open,
  onClose,
  itemId,
  itemType,
  itemName,
}: WhereUsedModalProps): React.ReactElement {
  // Fetch details based on item type
  const optionQuery = useOptionDetail(itemType === 'option' ? itemId : '');
  const upchargeQuery = useUpchargeDetail(
    itemType === 'upcharge' ? itemId : '',
  );

  // Determine loading and data based on type
  const isLoading =
    (itemType === 'option' && optionQuery.isLoading) ||
    (itemType === 'upcharge' && upchargeQuery.isLoading);

  const usedByMSIs =
    itemType === 'option'
      ? optionQuery.data?.option.usedByMSIs
      : itemType === 'upcharge'
        ? upchargeQuery.data?.upcharge.usedByMSIs
        : [];

  const getTypeLabel = () => {
    switch (itemType) {
      case 'option':
        return 'Option';
      case 'upcharge':
        return 'UpCharge';
      case 'additional-detail':
        return 'Additional Detail';
      default:
        return 'Item';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1">Where Used</Typography>
          <Typography variant="body2" color="text.secondary">
            {getTypeLabel()}: {itemName}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !usedByMSIs || usedByMSIs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              This {getTypeLabel().toLowerCase()} is not used by any measure
              sheet items.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Used in {usedByMSIs.length} measure sheet item
              {usedByMSIs.length !== 1 ? 's' : ''}:
            </Typography>
            <List dense disablePadding>
              {usedByMSIs.map(msi => (
                <ListItem
                  key={msi.id}
                  sx={{
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemText
                    primary={msi.name}
                    secondary={
                      <Chip
                        label={msi.categoryName}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
