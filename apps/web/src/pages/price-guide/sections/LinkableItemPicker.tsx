/**
 * Generic Linkable Item Picker Component.
 * Reusable component for linking/unlinking items (Options, UpCharges, Additional Details).
 *
 * Features:
 * - Full-width search bar with optional tag filtering
 * - Two aligned columns: Available Items and Linked Items
 * - Customizable display via render props
 * - Infinite scroll support
 */

import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { TagFilterSelect } from '../../../components/price-guide';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useTagList } from '../../../hooks/useTags';

// ============================================================================
// Types
// ============================================================================

/** Base item type - all items must have at least an id */
export type BaseItem = {
  id: string;
  [key: string]: unknown;
};

/** Props for the generic LinkableItemPicker component */
export type LinkableItemPickerProps<
  TAvailable extends BaseItem,
  TLinked extends BaseItem,
> = {
  // Data
  /** Array of available items from the API (all pages flattened) */
  availableItems: TAvailable[];
  /** Array of currently linked items */
  linkedItems: TLinked[];
  /** Function to get the ID from a linked item (defaults to item.id) */
  getLinkedItemId?: (item: TLinked) => string;

  // Callbacks
  /** Called when an available item is clicked to link it */
  onLinkItem: (item: TAvailable) => void;
  /** Called when a linked item's delete button is clicked */
  onUnlinkItem: (itemId: string) => void;
  /** Called when search text changes (for parent to handle API filtering) */
  onSearchChange?: (search: string) => void;
  /** Called when tag filter changes (for parent to handle API filtering) */
  onTagFilterChange?: (tags: string[]) => void;

  // Display customization
  /** Get primary text for an available item */
  getAvailableItemPrimary: (item: TAvailable) => string;
  /** Get secondary text for an available item (optional) */
  getAvailableItemSecondary?: (item: TAvailable) => string | undefined;
  /** Get primary text for a linked item */
  getLinkedItemPrimary: (item: TLinked) => string;
  /** Get secondary text for a linked item (optional) */
  getLinkedItemSecondary?: (item: TLinked) => string | undefined;
  /** Custom render for linked items (overrides default list rendering) */
  renderLinkedItem?: (
    item: TLinked,
    onUnlink: (id: string) => void,
  ) => React.ReactNode;

  // Labels
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Label for available items column */
  availableLabel?: string;
  /** Label for linked items column */
  linkedLabel?: string;
  /** Empty state message when no items are available */
  emptyAvailableMessage?: string;
  /** Empty state message when no items are linked */
  emptyLinkedMessage?: string;

  // Configuration
  /** Enable tag filtering */
  enableTagFilter?: boolean;
  /** Maximum height for list panels */
  maxHeight?: number;
  /** Minimum height for list panels */
  minHeight?: number;

  // Loading states
  /** Whether the available items are loading */
  isLoading?: boolean;
  /** Whether linking is in progress */
  isLinking?: boolean;
  /** Whether unlinking is in progress */
  isUnlinking?: boolean;
  /** Whether there's an error loading items */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;

  // Infinite scroll
  /** Whether there are more pages to load */
  hasNextPage?: boolean;
  /** Whether currently fetching next page */
  isFetchingNextPage?: boolean;
  /** Function to fetch next page */
  fetchNextPage?: () => void;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Generic picker component for linking/unlinking items.
 * Used for Options, UpCharges, and Additional Details.
 */
export function LinkableItemPicker<
  TAvailable extends BaseItem,
  TLinked extends BaseItem,
>({
  // Data
  availableItems,
  linkedItems,
  getLinkedItemId = item => item.id,

  // Callbacks
  onLinkItem,
  onUnlinkItem,
  onSearchChange,
  onTagFilterChange,

  // Display
  getAvailableItemPrimary,
  getAvailableItemSecondary,
  getLinkedItemPrimary,
  getLinkedItemSecondary,
  renderLinkedItem,

  // Labels
  searchPlaceholder = 'Search items...',
  availableLabel = 'Available',
  linkedLabel = 'Selected',
  emptyAvailableMessage = 'No items available',
  emptyLinkedMessage = 'No items selected',

  // Configuration
  enableTagFilter = false,
  maxHeight = 300,
  minHeight = 200,

  // Loading states
  isLoading = false,
  isLinking = false,
  isUnlinking = false,
  error = false,
  errorMessage = 'Failed to load items. Please try again.',

  // Infinite scroll
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: LinkableItemPickerProps<TAvailable, TLinked>): React.ReactElement {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Fetch tags for filtering (only if enabled)
  const { data: tagsData } = useTagList();

  // Filter out already linked items
  const filteredAvailableItems = useMemo(() => {
    const linkedIds = new Set(linkedItems.map(getLinkedItemId));
    return availableItems.filter(item => !linkedIds.has(item.id));
  }, [availableItems, linkedItems, getLinkedItemId]);

  // Notify parent of search changes
  useEffect(() => {
    onSearchChange?.(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  // Notify parent of tag filter changes
  useEffect(() => {
    onTagFilterChange?.(tagFilter);
  }, [tagFilter, onTagFilterChange]);

  // Infinite scroll observer
  useEffect(() => {
    if (!fetchNextPage) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    [],
  );

  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, []);

  return (
    <Box>
      {/* Search and Filter - Full Width */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          placeholder={searchPlaceholder}
          value={search}
          onChange={handleSearchChange}
          size="small"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {enableTagFilter && tagsData?.tags && tagsData.tags.length > 0 && (
          <TagFilterSelect
            value={tagFilter}
            onChange={setTagFilter}
            tags={tagsData.tags}
            label="Filter by Tags"
            minWidth={200}
            size="small"
          />
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Two Columns - Aligned */}
      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Left: Available Items */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            {availableLabel} ({filteredAvailableItems.length})
          </Typography>
          <Paper
            variant="outlined"
            sx={{ maxHeight, overflow: 'auto', minHeight }}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : filteredAvailableItems.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ p: 2, textAlign: 'center' }}
              >
                {search || tagFilter.length > 0
                  ? 'No matching items found'
                  : emptyAvailableMessage}
              </Typography>
            ) : (
              <List dense disablePadding>
                {filteredAvailableItems.map(item => (
                  <ListItem
                    key={item.id}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => onLinkItem(item)}
                  >
                    <ListItemText
                      primary={getAvailableItemPrimary(item)}
                      secondary={getAvailableItemSecondary?.(item)}
                    />
                    {isLinking && <CircularProgress size={16} sx={{ ml: 1 }} />}
                  </ListItem>
                ))}
                <Box ref={loadMoreRef} sx={{ height: 1 }} />
                {isFetchingNextPage && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
                    <CircularProgress size={20} />
                  </Box>
                )}
              </List>
            )}
          </Paper>
        </Box>

        {/* Right: Linked Items */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            {linkedLabel} ({linkedItems.length})
          </Typography>
          {linkedItems.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: 'action.hover',
                minHeight,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {emptyLinkedMessage}
              </Typography>
            </Paper>
          ) : renderLinkedItem ? (
            // Custom render for linked items
            <Box sx={{ maxHeight, overflow: 'auto', minHeight }}>
              {linkedItems.map(item => (
                <Box key={getLinkedItemId(item)}>
                  {renderLinkedItem(item, onUnlinkItem)}
                </Box>
              ))}
            </Box>
          ) : (
            // Default list rendering for linked items
            <Paper
              variant="outlined"
              sx={{ maxHeight, overflow: 'auto', minHeight }}
            >
              <List dense disablePadding>
                {linkedItems.map(item => (
                  <ListItem key={getLinkedItemId(item)}>
                    <ListItemText
                      primary={getLinkedItemPrimary(item)}
                      secondary={getLinkedItemSecondary?.(item)}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => onUnlinkItem(getLinkedItemId(item))}
                        disabled={isUnlinking}
                      >
                        {isUnlinking ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteIcon fontSize="small" />
                        )}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}
