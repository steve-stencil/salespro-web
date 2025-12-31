/**
 * UpCharges Section Component.
 * Handles linking/unlinking upcharges with option compatibility settings.
 * Uses the generic LinkableItemPicker with custom linked item rendering.
 */

import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo } from 'react';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUpchargeList } from '../../../hooks/usePriceGuide';

import { LinkableItemPicker } from './LinkableItemPicker';

import type {
  LinkedUpCharge,
  WizardState,
} from '../../../components/price-guide/wizard/WizardContext';
import type { UpChargeSummary } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

export type UpchargesSectionProps = {
  state: WizardState;
  addUpcharge: (upcharge: LinkedUpCharge) => void;
  removeUpcharge: (upchargeId: string) => void;
  updateUpchargeDisabledOptions: (
    upchargeId: string,
    disabledOptionIds: string[],
  ) => void;
};

// ============================================================================
// UpCharge Card Component
// ============================================================================

type UpChargeCardProps = {
  upcharge: LinkedUpCharge;
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
 * Section for linking/unlinking upcharges to an MSI.
 */
export function UpchargesSection({
  state,
  addUpcharge,
  removeUpcharge,
  updateUpchargeDisabledOptions,
}: UpchargesSectionProps): React.ReactElement {
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
  } = useUpchargeList({
    search: debouncedSearch || undefined,
    tags: tagFilter.length > 0 ? tagFilter : undefined,
    limit: 20,
  });

  // Flatten pages
  const allUpcharges = useMemo(() => {
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

  const handleLinkUpcharge = useCallback(
    (upcharge: UpChargeSummary) => {
      addUpcharge({
        id: upcharge.id,
        name: upcharge.name,
        disabledOptionIds: [],
      });
    },
    [addUpcharge],
  );

  const handleToggleDisabledOption = useCallback(
    (upchargeId: string, optionId: string) => {
      const upcharge = state.upcharges.find(u => u.id === upchargeId);
      if (!upcharge) return;

      const newDisabledIds = upcharge.disabledOptionIds.includes(optionId)
        ? upcharge.disabledOptionIds.filter(id => id !== optionId)
        : [...upcharge.disabledOptionIds, optionId];

      updateUpchargeDisabledOptions(upchargeId, newDisabledIds);
    },
    [state.upcharges, updateUpchargeDisabledOptions],
  );

  // Custom render for linked upcharge cards
  const renderLinkedUpcharge = useCallback(
    (upcharge: LinkedUpCharge, onUnlink: (id: string) => void) => (
      <UpChargeCard
        upcharge={upcharge}
        options={state.options}
        onRemove={onUnlink}
        onToggleDisabledOption={handleToggleDisabledOption}
      />
    ),
    [state.options, handleToggleDisabledOption],
  );

  return (
    <LinkableItemPicker<UpChargeSummary, LinkedUpCharge>
      // Data
      availableItems={allUpcharges}
      linkedItems={state.upcharges}
      // Callbacks
      onLinkItem={handleLinkUpcharge}
      onUnlinkItem={removeUpcharge}
      onSearchChange={handleSearchChange}
      onTagFilterChange={handleTagFilterChange}
      // Display - Available items
      getAvailableItemPrimary={upcharge => upcharge.name}
      // Display - Linked items (custom render)
      getLinkedItemPrimary={upcharge => upcharge.name}
      renderLinkedItem={renderLinkedUpcharge}
      // Labels
      searchPlaceholder="Search upcharges..."
      availableLabel="Available UpCharges"
      linkedLabel="Selected UpCharges"
      emptyAvailableMessage="All upcharges have been added"
      emptyLinkedMessage="No upcharges selected. UpCharges are optional."
      // Configuration
      enableTagFilter={true}
      // Loading states
      isLoading={isLoading}
      error={!!error}
      errorMessage="Failed to load upcharges. Please try again."
      // Infinite scroll
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={() => void fetchNextPage()}
    />
  );
}
