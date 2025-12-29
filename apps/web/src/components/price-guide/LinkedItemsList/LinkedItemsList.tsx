/**
 * LinkedItemsList - Displays linked Options/UpCharges/Additional Details for an MSI.
 */
import AddLinkIcon from '@mui/icons-material/AddLink';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { CompatibilityBadge, UsageCountBadge } from '../RelationshipBadges';

import type {
  LinkedOption,
  LinkedUpCharge,
  LinkedAdditionalDetail,
} from '@shared/types';

export type LinkedItemsListProps = {
  /** Section title */
  title: string;
  /** Type of items in the list */
  itemType: 'option' | 'upcharge' | 'additionalDetail';
  /** Items to display */
  items: LinkedOption[] | LinkedUpCharge[] | LinkedAdditionalDetail[];
  /** Whether items are loading */
  isLoading?: boolean;
  /** Callback when "Link" button is clicked */
  onLinkClick?: () => void;
  /** Callback when "View" is clicked on an item */
  onViewItem?: (itemId: string) => void;
  /** Callback when "Unlink" is clicked on an item */
  onUnlinkItem?: (itemId: string) => void;
  /** Whether linking actions are available */
  canLink?: boolean;
  /** Disabled option counts for upcharges (keyed by upcharge ID) */
  disabledOptionCounts?: Record<string, number>;
  /** Usage counts for items (keyed by item ID) */
  usageCounts?: Record<string, number>;
};

/**
 * Component for displaying linked items with view/unlink actions.
 */
export function LinkedItemsList({
  title,
  itemType,
  items,
  isLoading = false,
  onLinkClick,
  onViewItem,
  onUnlinkItem,
  canLink = true,
  disabledOptionCounts = {},
  usageCounts = {},
}: LinkedItemsListProps): React.ReactElement {
  const getItemId = (
    item: LinkedOption | LinkedUpCharge | LinkedAdditionalDetail,
  ): string => {
    if ('optionId' in item) return item.optionId;
    if ('upchargeId' in item) return item.upchargeId;
    if ('fieldId' in item) return item.fieldId;
    return '';
  };

  const getItemName = (
    item: LinkedOption | LinkedUpCharge | LinkedAdditionalDetail,
  ): string => {
    // LinkedOption and LinkedUpCharge have 'name', LinkedAdditionalDetail has 'title'
    if ('title' in item) return item.title;
    return item.name;
  };

  const getItemSubtitle = (
    item: LinkedOption | LinkedUpCharge | LinkedAdditionalDetail,
  ): string | null => {
    if ('brand' in item && item.brand) return `Brand: ${item.brand}`;
    if ('note' in item && item.note) return item.note;
    if ('inputType' in item) return `Type: ${item.inputType}`;
    return null;
  };

  const linkLabel = (() => {
    switch (itemType) {
      case 'option':
        return 'Link Option';
      case 'upcharge':
        return 'Link UpCharge';
      case 'additionalDetail':
        return 'Link Detail';
    }
  })();

  if (isLoading) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: 'uppercase' }}
        >
          {title}
        </Typography>
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {[1, 2].map(i => (
            <ListItem key={i} sx={{ py: 0.5, px: 0 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Skeleton variant="circular" width={20} height={20} />
              </ListItemIcon>
              <ListItemText>
                <Skeleton variant="text" width="60%" height={20} />
              </ListItemText>
            </ListItem>
          ))}
        </List>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 0.5,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: 'uppercase' }}
        >
          {title} ({items.length})
        </Typography>
        {canLink && onLinkClick && (
          <Button
            size="small"
            startIcon={<AddLinkIcon />}
            onClick={onLinkClick}
            sx={{ minWidth: 'auto' }}
          >
            {linkLabel}
          </Button>
        )}
      </Box>

      {/* Items list */}
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No{' '}
          {itemType === 'additionalDetail'
            ? 'additional details'
            : `${itemType}s`}{' '}
          linked
        </Typography>
      ) : (
        <List
          dense
          disablePadding
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          {items.map((item, index) => {
            const itemId = getItemId(item);
            const subtitle = getItemSubtitle(item);
            const usageCount = usageCounts[itemId] ?? 0;
            const disabledCount = disabledOptionCounts[itemId] ?? 0;

            return (
              <ListItem
                key={itemId}
                sx={{
                  py: 0.5,
                  borderBottom: index < items.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {onViewItem && (
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() => onViewItem(itemId)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onUnlinkItem && (
                      <Tooltip title="Unlink">
                        <IconButton
                          size="small"
                          onClick={() => onUnlinkItem(itemId)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                }
              >
                <ListItemIcon sx={{ minWidth: 28, cursor: 'grab' }}>
                  <DragIndicatorIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={getItemName(item)}
                  secondary={subtitle}
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                    sx: { maxWidth: '200px' },
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    noWrap: true,
                    sx: { maxWidth: '200px' },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mr: 8 }}>
                  {itemType === 'upcharge' && (
                    <CompatibilityBadge disabledCount={disabledCount} />
                  )}
                  {usageCount > 0 && <UsageCountBadge count={usageCount} />}
                </Box>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}
