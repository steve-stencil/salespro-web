/**
 * Additional Details Section Component.
 * Handles linking/unlinking additional detail fields for MSI.
 */

import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
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

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAdditionalDetailList } from '../../../hooks/usePriceGuide';

import type {
  LinkedAdditionalDetail,
  WizardState,
} from '../../../components/price-guide/wizard/WizardContext';
import type { AdditionalDetailFieldSummary } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

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
  number: 'Number',
  picker: 'Picker',
  date: 'Date',
  toggle: 'Toggle',
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Section for linking/unlinking additional details to an MSI.
 */
export function AdditionalDetailsSection({
  state,
  addAdditionalDetail,
  removeAdditionalDetail,
}: AdditionalDetailsSectionProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
    limit: 20,
  });

  // Flatten pages
  const allDetails = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

  // Filter out already selected
  const availableDetails = useMemo(() => {
    const selectedIds = new Set(state.additionalDetails.map(d => d.id));
    return allDetails.filter(d => !selectedIds.has(d.id));
  }, [allDetails, state.additionalDetails]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
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

  const handleSelectDetail = useCallback(
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
    <Box sx={{ display: 'flex', gap: 3 }}>
      {/* Left: Search & Select */}
      <Box sx={{ flex: 1 }}>
        <TextField
          placeholder="Search additional details..."
          value={search}
          onChange={handleSearchChange}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
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

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load additional details. Please try again.
          </Alert>
        )}

        <Paper
          variant="outlined"
          sx={{ maxHeight: 300, overflow: 'auto', minHeight: 200 }}
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : availableDetails.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ p: 2, textAlign: 'center' }}
            >
              {search
                ? 'No matching additional details found'
                : 'All additional details have been added'}
            </Typography>
          ) : (
            <List dense disablePadding>
              {availableDetails.map(detail => (
                <ListItem
                  key={detail.id}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => handleSelectDetail(detail)}
                >
                  <ListItemText
                    primary={detail.title}
                    secondary={
                      INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
                    }
                  />
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

      {/* Right: Selected Details */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Selected Details ({state.additionalDetails.length})
        </Typography>
        {state.additionalDetails.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover' }}
          >
            <Typography variant="body2" color="text.secondary">
              No additional details selected. Additional details are optional.
            </Typography>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List dense disablePadding>
              {state.additionalDetails.map(detail => (
                <ListItem key={detail.id}>
                  <ListItemText
                    primary={detail.title}
                    secondary={
                      INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
                    }
                  />
                  <Chip
                    label={
                      INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
                    }
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={() => removeAdditionalDetail(detail.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
