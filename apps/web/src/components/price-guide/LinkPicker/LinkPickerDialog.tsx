/**
 * LinkPickerDialog - Dialog wrapper for LinkableItemPicker.
 * Provides a consistent UI for linking Offices, Options, and UpCharges to MSIs.
 */
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useMemo, useState, useEffect } from 'react';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useOfficesList } from '../../../hooks/useOffices';
import { useOptionList, useUpchargeList } from '../../../hooks/usePriceGuide';
import { LinkableItemPicker } from '../../../pages/price-guide/sections/LinkableItemPicker';

import type { OptionSummary, UpChargeSummary } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

export type LinkPickerDialogType = 'office' | 'option' | 'upcharge';

export type LinkedOffice = {
  id: string;
  name: string;
};

export type LinkedOption = {
  id: string;
  name: string;
  brand?: string | null;
};

export type LinkedUpcharge = {
  id: string;
  name: string;
  disabledOptionIds: string[];
};

export type LinkPickerDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Type of items being linked */
  itemType: LinkPickerDialogType;
  /** Currently linked offices (when itemType is 'office') */
  linkedOffices?: LinkedOffice[];
  /** Currently linked options (when itemType is 'option') */
  linkedOptions?: LinkedOption[];
  /** Currently linked upcharges (when itemType is 'upcharge') */
  linkedUpcharges?: LinkedUpcharge[];
  /** All options linked to the MSI (for disabled options dropdown in upcharge mode) */
  msiOptions?: Array<{ id: string; name: string; brand: string | null }>;
  /** Callback when an item is linked */
  onLink: (itemId: string) => void;
  /** Callback when an item is unlinked */
  onUnlink: (itemId: string) => void;
  /** Callback when disabled options are updated for an upcharge */
  onUpdateDisabledOptions?: (upchargeId: string, optionIds: string[]) => void;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Whether a link operation is in progress */
  isLinking?: boolean;
  /** Whether an unlink operation is in progress */
  isUnlinking?: boolean;
};

// ============================================================================
// Constants
// ============================================================================

const itemTypeConfig: Record<
  LinkPickerDialogType,
  {
    title: string;
    availableLabel: string;
    linkedLabel: string;
    searchPlaceholder: string;
    emptyAvailableMessage: string;
    emptyLinkedMessage: string;
    enableTagFilter: boolean;
  }
> = {
  office: {
    title: 'Link Offices',
    availableLabel: 'Available Offices',
    linkedLabel: 'Linked Offices',
    searchPlaceholder: 'Search offices...',
    emptyAvailableMessage: 'No matching offices found',
    emptyLinkedMessage: 'No offices linked yet.',
    enableTagFilter: false, // Offices don't use tags
  },
  option: {
    title: 'Link Options',
    availableLabel: 'Available Options',
    linkedLabel: 'Linked Options',
    searchPlaceholder: 'Search options...',
    emptyAvailableMessage: 'No matching options found',
    emptyLinkedMessage: 'No options linked yet.',
    enableTagFilter: true,
  },
  upcharge: {
    title: 'Link UpCharges',
    availableLabel: 'Available UpCharges',
    linkedLabel: 'Linked UpCharges',
    searchPlaceholder: 'Search upcharges...',
    emptyAvailableMessage: 'No matching upcharges found',
    emptyLinkedMessage: 'No upcharges linked yet.',
    enableTagFilter: true,
  },
};

// ============================================================================
// Office Item Type (for internal use)
// ============================================================================

type OfficeItem = {
  id: string;
  name: string;
};

// ============================================================================
// UpCharge Card Component (for custom rendering of linked upcharges)
// ============================================================================

type UpChargeCardProps = {
  upcharge: LinkedUpcharge;
  options: Array<{ id: string; name: string; brand: string | null }>;
  onRemove: (id: string) => void;
  onToggleDisabledOption: (upchargeId: string, optionId: string) => void;
};

function UpChargeCard({
  upcharge,
  options,
  onRemove,
  onToggleDisabledOption,
}: UpChargeCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const disabledCount = upcharge.disabledOptionIds.length;

  return (
    <Paper variant="outlined" sx={{ mb: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          cursor: options.length > 0 ? 'pointer' : 'default',
        }}
        onClick={() => options.length > 0 && setExpanded(!expanded)}
      >
        {options.length > 0 && (
          <IconButton size="small" sx={{ mr: 0.5 }}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            {upcharge.name}
          </Typography>
          {disabledCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {disabledCount} option{disabledCount !== 1 ? 's' : ''} disabled
            </Typography>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={e => {
            e.stopPropagation();
            onRemove(upcharge.id);
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {options.length > 0 && (
        <Collapse in={expanded}>
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 1, display: 'block' }}
            >
              Disable this upcharge for specific options:
            </Typography>
            <Stack spacing={0.5}>
              {options.map(option => (
                <FormControlLabel
                  key={option.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={upcharge.disabledOptionIds.includes(option.id)}
                      onChange={() =>
                        onToggleDisabledOption(upcharge.id, option.id)
                      }
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {option.brand
                        ? `${option.name} (${option.brand})`
                        : option.name}
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
              ))}
            </Stack>
          </Box>
        </Collapse>
      )}
    </Paper>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Dialog for linking Offices, Options, or UpCharges to an MSI.
 * Uses the LinkableItemPicker component for consistent UI.
 */
export function LinkPickerDialog({
  open,
  itemType,
  linkedOffices = [],
  linkedOptions = [],
  linkedUpcharges = [],
  msiOptions = [],
  onLink,
  onUnlink,
  onUpdateDisabledOptions,
  onClose,
  isLinking = false,
  isUnlinking = false,
}: LinkPickerDialogProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const debouncedSearch = useDebouncedValue(search, 300);
  const config = itemTypeConfig[itemType];

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearch('');
      setTagFilter([]);
    }
  }, [open]);

  // Fetch offices (only when itemType is 'office')
  const { data: officesData, isLoading: isLoadingOffices } = useOfficesList();

  // Fetch options (only when itemType is 'option')
  const {
    data: optionsData,
    isLoading: isLoadingOptions,
    isFetchingNextPage: isFetchingMoreOptions,
    hasNextPage: hasMoreOptions,
    fetchNextPage: fetchMoreOptions,
    error: optionsError,
  } = useOptionList({
    search: debouncedSearch || undefined,
    tags: tagFilter.length > 0 ? tagFilter : undefined,
    limit: 20,
  });

  // Fetch upcharges (only when itemType is 'upcharge')
  const {
    data: upchargesData,
    isLoading: isLoadingUpcharges,
    isFetchingNextPage: isFetchingMoreUpcharges,
    hasNextPage: hasMoreUpcharges,
    fetchNextPage: fetchMoreUpcharges,
    error: upchargesError,
  } = useUpchargeList({
    search: debouncedSearch || undefined,
    tags: tagFilter.length > 0 ? tagFilter : undefined,
    limit: 20,
  });

  // Select the appropriate data based on itemType
  const isLoading =
    itemType === 'office'
      ? isLoadingOffices
      : itemType === 'option'
        ? isLoadingOptions
        : isLoadingUpcharges;

  const isFetchingNextPage =
    itemType === 'office'
      ? false
      : itemType === 'option'
        ? isFetchingMoreOptions
        : isFetchingMoreUpcharges;

  const hasNextPage =
    itemType === 'office'
      ? false
      : itemType === 'option'
        ? hasMoreOptions
        : hasMoreUpcharges;

  const fetchNextPage =
    itemType === 'office'
      ? () => {}
      : itemType === 'option'
        ? fetchMoreOptions
        : fetchMoreUpcharges;

  const error =
    itemType === 'office'
      ? null
      : itemType === 'option'
        ? optionsError
        : upchargesError;

  // Get all items and filter by search for offices (client-side filtering)
  const allItems = useMemo(() => {
    if (itemType === 'office') {
      if (!officesData?.offices) return [] as OfficeItem[];
      const offices = officesData.offices.map(o => ({
        id: o.id,
        name: o.name,
      }));
      // Client-side search filtering for offices
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        return offices.filter(o => o.name.toLowerCase().includes(searchLower));
      }
      return offices;
    } else if (itemType === 'option') {
      if (!optionsData?.pages) return [] as OptionSummary[];
      return optionsData.pages.flatMap(page => page.items);
    } else {
      if (!upchargesData?.pages) return [] as UpChargeSummary[];
      return upchargesData.pages.flatMap(page => page.items);
    }
  }, [itemType, officesData, optionsData, upchargesData, debouncedSearch]);

  // Get linked items based on itemType
  const linkedItems = useMemo(() => {
    if (itemType === 'office') {
      return linkedOffices;
    } else if (itemType === 'option') {
      return linkedOptions;
    } else {
      return linkedUpcharges;
    }
  }, [itemType, linkedOffices, linkedOptions, linkedUpcharges]);

  // Handlers for search and tag filter changes
  const handleSearchChange = useCallback((searchValue: string) => {
    setSearch(searchValue);
  }, []);

  const handleTagFilterChange = useCallback((tags: string[]) => {
    setTagFilter(tags);
  }, []);

  // Link/unlink handlers
  const handleLinkItem = useCallback(
    (item: OfficeItem | OptionSummary | UpChargeSummary) => {
      onLink(item.id);
    },
    [onLink],
  );

  const handleUnlinkItem = useCallback(
    (itemId: string) => {
      onUnlink(itemId);
    },
    [onUnlink],
  );

  // Handler for toggling disabled options
  const handleToggleDisabledOption = useCallback(
    (upchargeId: string, optionId: string) => {
      if (!onUpdateDisabledOptions) return;

      const upcharge = linkedUpcharges.find(u => u.id === upchargeId);
      if (!upcharge) return;

      const newDisabledIds = upcharge.disabledOptionIds.includes(optionId)
        ? upcharge.disabledOptionIds.filter(id => id !== optionId)
        : [...upcharge.disabledOptionIds, optionId];

      onUpdateDisabledOptions(upchargeId, newDisabledIds);
    },
    [linkedUpcharges, onUpdateDisabledOptions],
  );

  // Custom render for linked upcharges (shows expandable options dropdown)
  const renderLinkedUpcharge = useCallback(
    (
      item: LinkedUpcharge,
      onUnlinkFn: (id: string) => void,
    ): React.ReactNode => {
      return (
        <UpChargeCard
          key={item.id}
          upcharge={item}
          options={msiOptions}
          onRemove={onUnlinkFn}
          onToggleDisabledOption={handleToggleDisabledOption}
        />
      );
    },
    [msiOptions, handleToggleDisabledOption],
  );

  // Render the appropriate picker based on itemType
  const renderPicker = () => {
    if (itemType === 'office') {
      return (
        <LinkableItemPicker<OfficeItem, LinkedOffice>
          // Data
          availableItems={allItems}
          linkedItems={linkedItems}
          // Callbacks
          onLinkItem={handleLinkItem}
          onUnlinkItem={handleUnlinkItem}
          onSearchChange={handleSearchChange}
          // Display - Available items
          getAvailableItemPrimary={item => item.name}
          // Display - Linked items
          getLinkedItemPrimary={item => item.name}
          // Labels
          searchPlaceholder={config.searchPlaceholder}
          availableLabel={config.availableLabel}
          linkedLabel={config.linkedLabel}
          emptyAvailableMessage={config.emptyAvailableMessage}
          emptyLinkedMessage={config.emptyLinkedMessage}
          // Configuration - NO tag filter for offices
          enableTagFilter={false}
          maxHeight={350}
          minHeight={250}
          // Loading states
          isLoading={isLoading}
          isLinking={isLinking}
          isUnlinking={isUnlinking}
          error={!!error}
          // No infinite scroll for offices (loaded all at once)
          hasNextPage={false}
          isFetchingNextPage={false}
        />
      );
    } else if (itemType === 'option') {
      return (
        <LinkableItemPicker<OptionSummary, LinkedOption>
          // Data
          availableItems={allItems as OptionSummary[]}
          linkedItems={linkedItems as LinkedOption[]}
          // Callbacks
          onLinkItem={handleLinkItem}
          onUnlinkItem={handleUnlinkItem}
          onSearchChange={handleSearchChange}
          onTagFilterChange={handleTagFilterChange}
          // Display - Available items
          getAvailableItemPrimary={item => item.name}
          getAvailableItemSecondary={item => item.brand ?? undefined}
          // Display - Linked items
          getLinkedItemPrimary={item => item.name}
          getLinkedItemSecondary={item => item.brand ?? undefined}
          // Labels
          searchPlaceholder={config.searchPlaceholder}
          availableLabel={config.availableLabel}
          linkedLabel={config.linkedLabel}
          emptyAvailableMessage={config.emptyAvailableMessage}
          emptyLinkedMessage={config.emptyLinkedMessage}
          // Configuration
          enableTagFilter={config.enableTagFilter}
          maxHeight={350}
          minHeight={250}
          // Loading states
          isLoading={isLoading}
          isLinking={isLinking}
          isUnlinking={isUnlinking}
          error={!!error}
          // Infinite scroll
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={() => void fetchNextPage()}
        />
      );
    } else {
      return (
        <LinkableItemPicker<UpChargeSummary, LinkedUpcharge>
          // Data
          availableItems={allItems as UpChargeSummary[]}
          linkedItems={linkedItems as LinkedUpcharge[]}
          // Callbacks
          onLinkItem={handleLinkItem}
          onUnlinkItem={handleUnlinkItem}
          onSearchChange={handleSearchChange}
          onTagFilterChange={handleTagFilterChange}
          // Display - Available items
          getAvailableItemPrimary={item => item.name}
          getAvailableItemSecondary={item => item.note ?? undefined}
          // Display - Linked items
          getLinkedItemPrimary={item => item.name}
          getLinkedItemSecondary={() => undefined}
          // Custom render for linked upcharges
          renderLinkedItem={renderLinkedUpcharge}
          // Labels
          searchPlaceholder={config.searchPlaceholder}
          availableLabel={config.availableLabel}
          linkedLabel={config.linkedLabel}
          emptyAvailableMessage={config.emptyAvailableMessage}
          emptyLinkedMessage={config.emptyLinkedMessage}
          // Configuration
          enableTagFilter={config.enableTagFilter}
          maxHeight={350}
          minHeight={250}
          // Loading states
          isLoading={isLoading}
          isLinking={isLinking}
          isUnlinking={isUnlinking}
          error={!!error}
          // Infinite scroll
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={() => void fetchNextPage()}
        />
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="link-picker-dialog-title"
    >
      <DialogTitle id="link-picker-dialog-title">{config.title}</DialogTitle>
      <DialogContent>{renderPicker()}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
