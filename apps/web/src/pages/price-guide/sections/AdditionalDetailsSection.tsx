/**
 * Additional Details Section Component.
 * Handles linking/unlinking additional detail fields for MSI or UpCharge.
 * Uses the generic LinkableItemPicker with tag filtering.
 */

import { useState, useCallback, useMemo } from 'react';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAdditionalDetailList } from '../../../hooks/usePriceGuide';

import { LinkableItemPicker } from './LinkableItemPicker';

import type {
  LinkedAdditionalDetail,
  WizardState,
} from '../../../components/price-guide/wizard/WizardContext';
import type { AdditionalDetailFieldSummary } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

/** Generic linked detail item type for the picker */
export type LinkedDetailItem = {
  id: string;
  title: string;
  inputType: string;
};

/** Props for the reusable AdditionalDetailsPicker component */
export type AdditionalDetailsPickerProps = {
  /** Array of currently linked detail items */
  linkedDetails: LinkedDetailItem[];
  /** Callback when a detail is selected to link */
  onLinkDetail: (detail: AdditionalDetailFieldSummary) => void;
  /** Callback when a detail is unlinked */
  onUnlinkDetail: (detailId: string) => void;
  /** Show loading spinner when linking */
  isLinking?: boolean;
  /** Show loading spinner when unlinking */
  isUnlinking?: boolean;
  /** Maximum height for the list panels */
  maxHeight?: number;
  /** Minimum height for the list panels */
  minHeight?: number;
  /** Label for the linked details column */
  linkedLabel?: string;
  /** Label for the available details column */
  availableLabel?: string;
  /** Empty state message for linked details */
  emptyLinkedMessage?: string;
};

/** Props for the MSI-specific wrapper component */
export type AdditionalDetailsSectionProps = {
  state: WizardState;
  addAdditionalDetail: (detail: LinkedAdditionalDetail) => void;
  removeAdditionalDetail: (detailId: string) => void;
};

// ============================================================================
// Constants
// ============================================================================

const INPUT_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  textarea: 'Text Area',
  number: 'Number',
  currency: 'Currency',
  picker: 'Picker',
  size_picker: 'Size (2D)',
  size_picker_3d: 'Size (3D)',
  date: 'Date',
  time: 'Time',
  datetime: 'Date & Time',
  united_inch: 'United Inch',
  toggle: 'Toggle',
};

// ============================================================================
// Reusable Picker Component (for UpCharge edit dialog)
// ============================================================================

/**
 * Reusable component for linking/unlinking additional details.
 * Can be used for MSI edit, UpCharge edit, or any other context.
 */
export function AdditionalDetailsPicker({
  linkedDetails,
  onLinkDetail,
  onUnlinkDetail,
  isLinking = false,
  isUnlinking = false,
  maxHeight = 300,
  minHeight = 200,
  linkedLabel = 'Selected Details',
  emptyLinkedMessage = 'No additional details selected. Additional details are optional.',
}: AdditionalDetailsPickerProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Queries
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useAdditionalDetailList({
    search: debouncedSearch || undefined,
    tags: tagFilter.length > 0 ? tagFilter : undefined,
    limit: 20,
  });

  // Flatten pages
  const allDetails = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

  // Handlers
  const handleSearchChange = useCallback((searchValue: string) => {
    setSearch(searchValue);
  }, []);

  const handleTagFilterChange = useCallback((tags: string[]) => {
    setTagFilter(tags);
  }, []);

  return (
    <LinkableItemPicker<AdditionalDetailFieldSummary, LinkedDetailItem>
      // Data
      availableItems={allDetails}
      linkedItems={linkedDetails}
      // Callbacks
      onLinkItem={onLinkDetail}
      onUnlinkItem={onUnlinkDetail}
      onSearchChange={handleSearchChange}
      onTagFilterChange={handleTagFilterChange}
      // Display - Available items
      getAvailableItemPrimary={detail => detail.title}
      getAvailableItemSecondary={detail =>
        INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
      }
      // Display - Linked items
      getLinkedItemPrimary={detail => detail.title}
      getLinkedItemSecondary={detail =>
        INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
      }
      // Labels
      searchPlaceholder="Search additional details..."
      availableLabel="Available Details"
      linkedLabel={linkedLabel}
      emptyAvailableMessage="All additional details have been added"
      emptyLinkedMessage={emptyLinkedMessage}
      // Configuration
      enableTagFilter={true}
      maxHeight={maxHeight}
      minHeight={minHeight}
      // Loading states
      isLoading={isLoading}
      isLinking={isLinking}
      isUnlinking={isUnlinking}
      error={!!error}
      errorMessage="Failed to load additional details. Please try again."
      // Infinite scroll
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={() => void fetchNextPage()}
    />
  );
}

// ============================================================================
// MSI-Specific Wrapper Component
// ============================================================================

/**
 * Section for linking/unlinking additional details to an MSI.
 * This is a wrapper that integrates with WizardState.
 */
export function AdditionalDetailsSection({
  state,
  addAdditionalDetail,
  removeAdditionalDetail,
}: AdditionalDetailsSectionProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Queries
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useAdditionalDetailList({
    search: debouncedSearch || undefined,
    tags: tagFilter.length > 0 ? tagFilter : undefined,
    limit: 20,
  });

  // Flatten pages
  const allDetails = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

  // Map state.additionalDetails to LinkedDetailItem format
  const linkedDetails = useMemo<LinkedDetailItem[]>(() => {
    return state.additionalDetails.map(d => ({
      id: d.id,
      title: d.title,
      inputType: d.inputType,
    }));
  }, [state.additionalDetails]);

  // Handlers
  const handleSearchChange = useCallback((searchValue: string) => {
    setSearch(searchValue);
  }, []);

  const handleTagFilterChange = useCallback((tags: string[]) => {
    setTagFilter(tags);
  }, []);

  const handleLinkDetail = useCallback(
    (detail: AdditionalDetailFieldSummary) => {
      addAdditionalDetail({
        id: detail.id,
        title: detail.title,
        inputType: detail.inputType,
      });
    },
    [addAdditionalDetail],
  );

  return (
    <LinkableItemPicker<AdditionalDetailFieldSummary, LinkedDetailItem>
      // Data
      availableItems={allDetails}
      linkedItems={linkedDetails}
      // Callbacks
      onLinkItem={handleLinkDetail}
      onUnlinkItem={removeAdditionalDetail}
      onSearchChange={handleSearchChange}
      onTagFilterChange={handleTagFilterChange}
      // Display - Available items
      getAvailableItemPrimary={detail => detail.title}
      getAvailableItemSecondary={detail =>
        INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
      }
      // Display - Linked items
      getLinkedItemPrimary={detail => detail.title}
      getLinkedItemSecondary={detail =>
        INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
      }
      // Labels
      searchPlaceholder="Search additional details..."
      availableLabel="Available Details"
      linkedLabel="Selected Details"
      emptyAvailableMessage="All additional details have been added"
      emptyLinkedMessage="No additional details selected. Additional details are optional."
      // Configuration
      enableTagFilter={true}
      // Loading states
      isLoading={isLoading}
      error={!!error}
      errorMessage="Failed to load additional details. Please try again."
      // Infinite scroll
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={() => void fetchNextPage()}
    />
  );
}
