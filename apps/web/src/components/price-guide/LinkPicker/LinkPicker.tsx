/**
 * LinkPicker - Modal for selecting items to link to an MSI.
 * Supports Options, UpCharges, and Additional Details.
 */
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { UsageCountBadge } from '../RelationshipBadges';

export type LinkableItemType =
  | 'office'
  | 'option'
  | 'upcharge'
  | 'additionalDetail';

export type LinkableItem = {
  id: string;
  name: string;
  /** Secondary text (brand for options, note for upcharges) */
  subtitle?: string | null;
  /** Number of MSIs using this item */
  usageCount: number;
  /** Whether this item is already linked */
  isAlreadyLinked?: boolean;
};

export type LinkPickerProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Type of items being linked */
  itemType: LinkableItemType;
  /** Title for the dialog (defaults based on itemType) */
  title?: string;
  /** Available items to choose from */
  items: LinkableItem[];
  /** IDs of items that are already linked (shown but disabled) */
  alreadyLinkedIds?: string[];
  /** Whether items are loading */
  isLoading?: boolean;
  /** Whether more items are available */
  hasMore?: boolean;
  /** Callback to load more items */
  onLoadMore?: () => void;
  /** Whether more items are loading */
  isLoadingMore?: boolean;
  /** Search callback */
  onSearch?: (query: string) => void;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when items are selected */
  onLink: (itemIds: string[]) => void;
  /** Callback to create a new item */
  onCreateNew?: () => void;
  /** Whether linking is in progress */
  isLinking?: boolean;
};

const itemTypeConfig: Record<
  LinkableItemType,
  { title: string; singular: string; plural: string }
> = {
  office: { title: 'Link Offices', singular: 'office', plural: 'offices' },
  option: { title: 'Link Options', singular: 'option', plural: 'options' },
  upcharge: {
    title: 'Link UpCharges',
    singular: 'upcharge',
    plural: 'upcharges',
  },
  additionalDetail: {
    title: 'Link Additional Details',
    singular: 'additional detail',
    plural: 'additional details',
  },
};

/**
 * Modal for selecting items to link to an MSI.
 */
export function LinkPicker({
  open,
  itemType,
  title,
  items,
  alreadyLinkedIds = [],
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  onSearch,
  onClose,
  onLink,
  onCreateNew,
  isLinking = false,
}: LinkPickerProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const config = itemTypeConfig[itemType];
  const dialogTitle = title ?? config.title;

  // Convert alreadyLinkedIds to a Set for efficient lookup
  const alreadyLinkedSet = useMemo(
    () => new Set(alreadyLinkedIds),
    [alreadyLinkedIds],
  );

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      onSearch?.(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, onSearch]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    const el = loadMoreRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) {
        observer.unobserve(el);
      }
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLink = useCallback(() => {
    onLink(Array.from(selectedIds));
  }, [selectedIds, onLink]);

  const availableItems = useMemo(
    () => items.filter(item => !alreadyLinkedSet.has(item.id)),
    [items, alreadyLinkedSet],
  );

  const linkedItems = useMemo(
    () => items.filter(item => alreadyLinkedSet.has(item.id)),
    [items, alreadyLinkedSet],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="link-picker-title"
    >
      <DialogTitle id="link-picker-title">{dialogTitle}</DialogTitle>
      <DialogContent>
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder={`Search ${config.plural}...`}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Selection count */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            AVAILABLE {config.plural.toUpperCase()}
          </Typography>
          <Typography variant="body2" color="primary">
            Selected: {selectedIds.size}
          </Typography>
        </Box>

        {/* Items list */}
        <Box
          sx={{
            maxHeight: 400,
            overflow: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : availableItems.length === 0 && linkedItems.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                {searchQuery
                  ? `No ${config.plural} found matching "${searchQuery}"`
                  : `No ${config.plural} available`}
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {availableItems.map(item => (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton
                    onClick={() => toggleItem(item.id)}
                    selected={selectedIds.has(item.id)}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        edge="start"
                        checked={selectedIds.has(item.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.name}
                      secondary={item.subtitle}
                      primaryTypographyProps={{ noWrap: true }}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                    <UsageCountBadge
                      count={item.usageCount}
                      sx={{ ml: 1, flexShrink: 0 }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}

              {/* Already linked section */}
              {linkedItems.length > 0 && (
                <>
                  <Divider />
                  <ListItem sx={{ bgcolor: 'action.hover' }}>
                    <ListItemText
                      primary="Already linked"
                      primaryTypographyProps={{
                        variant: 'caption',
                        color: 'text.secondary',
                      }}
                    />
                  </ListItem>
                  {linkedItems.map(item => (
                    <ListItem
                      key={item.id}
                      sx={{ bgcolor: 'action.disabledBackground' }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Checkbox edge="start" checked disabled />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={item.subtitle}
                        primaryTypographyProps={{
                          noWrap: true,
                          color: 'text.disabled',
                        }}
                        secondaryTypographyProps={{
                          noWrap: true,
                          color: 'text.disabled',
                        }}
                      />
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: 1 }}
                      >
                        Already linked
                      </Typography>
                    </ListItem>
                  ))}
                </>
              )}

              {/* Load more trigger */}
              {hasMore && (
                <Box
                  ref={loadMoreRef}
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    py: 2,
                  }}
                >
                  {isLoadingMore && <CircularProgress size={24} />}
                </Box>
              )}
            </List>
          )}
        </Box>

        {/* Create new option */}
        {onCreateNew && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Can&apos;t find what you need?
              </Typography>
            </Divider>
            <Button
              startIcon={<AddIcon />}
              onClick={onCreateNew}
              fullWidth
              variant="outlined"
            >
              Create New {config.singular}
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLinking}>
          Cancel
        </Button>
        <Button
          onClick={handleLink}
          variant="contained"
          disabled={selectedIds.size === 0 || isLinking}
        >
          {isLinking ? 'Linking...' : `Link Selected (${selectedIds.size})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
