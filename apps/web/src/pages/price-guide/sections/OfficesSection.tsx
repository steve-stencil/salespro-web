/**
 * Offices Section Component.
 * Handles multi-select office assignment for MSI using LinkableItemPicker.
 */

import { useCallback, useMemo } from 'react';

import { useOfficesList } from '../../../hooks/useOffices';

import { LinkableItemPicker } from './LinkableItemPicker';

import type { WizardState } from '../../../components/price-guide/wizard/WizardContext';

// ============================================================================
// Types
// ============================================================================

export type OfficesSectionProps = {
  state: WizardState;
  addOffice: (officeId: string) => void;
  removeOffice: (officeId: string) => void;
};

type OfficeItem = {
  id: string;
  name: string;
};

type LinkedOffice = {
  id: string;
  name: string;
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Section for editing office assignments for an MSI.
 * Uses LinkableItemPicker for consistent UI with other sections.
 */
export function OfficesSection({
  state,
  addOffice,
  removeOffice,
}: OfficesSectionProps): React.ReactElement {
  // Queries
  const { data: officesData, isLoading: isLoadingOffices } = useOfficesList();

  // Map all offices to OfficeItem format
  const allOffices = useMemo<OfficeItem[]>(() => {
    if (!officesData?.offices) return [];
    return officesData.offices.map(o => ({
      id: o.id,
      name: o.name,
    }));
  }, [officesData]);

  // Map linked office IDs to LinkedOffice format
  const linkedOffices = useMemo<LinkedOffice[]>(() => {
    if (!officesData?.offices) return [];
    // Find the office details for each linked ID
    return state.officeIds
      .map(officeId => {
        const office = officesData.offices.find(o => o.id === officeId);
        return office ? { id: office.id, name: office.name } : null;
      })
      .filter((o): o is LinkedOffice => o !== null);
  }, [state.officeIds, officesData]);

  // Handlers
  const handleLinkOffice = useCallback(
    (office: OfficeItem) => {
      addOffice(office.id);
    },
    [addOffice],
  );

  const handleUnlinkOffice = useCallback(
    (officeId: string) => {
      removeOffice(officeId);
    },
    [removeOffice],
  );

  return (
    <LinkableItemPicker<OfficeItem, LinkedOffice>
      // Data
      availableItems={allOffices}
      linkedItems={linkedOffices}
      // Callbacks
      onLinkItem={handleLinkOffice}
      onUnlinkItem={handleUnlinkOffice}
      // Display - Available items
      getAvailableItemPrimary={office => office.name}
      // Display - Linked items
      getLinkedItemPrimary={office => office.name}
      // Labels
      searchPlaceholder="Search offices..."
      availableLabel="Available Offices"
      linkedLabel="Selected Offices"
      emptyAvailableMessage="All offices have been selected"
      emptyLinkedMessage="No offices selected. At least one office is required."
      // Configuration - NO tag filter for offices
      enableTagFilter={false}
      maxHeight={300}
      minHeight={200}
      // Loading states
      isLoading={isLoadingOffices}
      error={false}
      // No infinite scroll for offices (loaded all at once)
      hasNextPage={false}
      isFetchingNextPage={false}
    />
  );
}
