/**
 * Options Section Component.
 * Handles linking/unlinking options for MSI using the generic LinkableItemPicker.
 */

import { useState, useCallback, useMemo } from 'react';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useOptionList } from '../../../hooks/usePriceGuide';

import { LinkableItemPicker } from './LinkableItemPicker';

import type {
  LinkedOption,
  WizardState,
} from '../../../components/price-guide/wizard/WizardContext';
import type { OptionSummary } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

export type OptionsSectionProps = {
  state: WizardState;
  addOption: (option: LinkedOption) => void;
  removeOption: (optionId: string) => void;
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Section for linking/unlinking options to an MSI.
 */
export function OptionsSection({
  state,
  addOption,
  removeOption,
}: OptionsSectionProps): React.ReactElement {
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
  } = useOptionList({
    search: debouncedSearch || undefined,
    tags: tagFilter.length > 0 ? tagFilter : undefined,
    limit: 20,
  });

  // Flatten pages
  const allOptions = useMemo(() => {
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

  const handleLinkOption = useCallback(
    (option: OptionSummary) => {
      addOption({
        id: option.id,
        name: option.name,
        brand: option.brand,
      });
    },
    [addOption],
  );

  return (
    <LinkableItemPicker<OptionSummary, LinkedOption>
      // Data
      availableItems={allOptions}
      linkedItems={state.options}
      // Callbacks
      onLinkItem={handleLinkOption}
      onUnlinkItem={removeOption}
      onSearchChange={handleSearchChange}
      onTagFilterChange={handleTagFilterChange}
      // Display - Available items
      getAvailableItemPrimary={option => option.name}
      getAvailableItemSecondary={option => option.brand ?? undefined}
      // Display - Linked items
      getLinkedItemPrimary={option => option.name}
      getLinkedItemSecondary={option => option.brand ?? undefined}
      // Labels
      searchPlaceholder="Search options..."
      availableLabel="Available Options"
      linkedLabel="Selected Options"
      emptyAvailableMessage="All options have been added"
      emptyLinkedMessage="No options selected. At least one option is required."
      // Configuration
      enableTagFilter={true}
      // Loading states
      isLoading={isLoading}
      error={!!error}
      errorMessage="Failed to load options. Please try again."
      // Infinite scroll
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={() => void fetchNextPage()}
    />
  );
}
