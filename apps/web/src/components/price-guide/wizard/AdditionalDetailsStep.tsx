/**
 * Additional Details Step Component.
 * Step 4 of the Create MSI Wizard.
 */

import AddIcon from '@mui/icons-material/Add';
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
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAdditionalDetailList } from '../../../hooks/usePriceGuide';
import { useWizard } from '../../../pages/price-guide/CreateWizard';

import type { AdditionalDetailFieldSummary } from '@shared/types';

// ============================================================================
// Input Type Labels
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

export function AdditionalDetailsStep(): React.ReactElement {
  const { state, addAdditionalDetail, removeAdditionalDetail } = useWizard();
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

  const handleRemoveDetail = useCallback(
    (detailId: string) => {
      removeAdditionalDetail(detailId);
    },
    [removeAdditionalDetail],
  );

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Additional Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Add custom fields that will appear when this item is added to a measure
        sheet. These fields collect additional information specific to this
        item.
      </Typography>

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
              Failed to load additional details.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : availableDetails.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  {search
                    ? 'No additional details match your search.'
                    : allDetails.length === state.additionalDetails.length
                      ? 'All additional details have been selected.'
                      : 'No additional details available.'}
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {availableDetails.map(detail => (
                  <ListItem
                    key={detail.id}
                    component="div"
                    onClick={() => handleSelectDetail(detail)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          {detail.title}
                          {detail.isRequired && (
                            <Chip
                              label="Required"
                              size="small"
                              color="warning"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => handleSelectDetail(detail)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}

            {/* Load More Trigger */}
            <Box
              ref={loadMoreRef}
              sx={{
                height: 40,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {isFetchingNextPage && <CircularProgress size={20} />}
            </Box>
          </Paper>
        </Box>

        {/* Right: Selected Details */}
        <Box sx={{ width: 300 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Details ({state.additionalDetails.length})
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: 1, minHeight: 200, bgcolor: 'grey.50' }}
          >
            {state.additionalDetails.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center', py: 4 }}
              >
                No additional details selected.
                <br />
                Click a detail to add it.
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {state.additionalDetails.map(detail => (
                  <Chip
                    key={detail.id}
                    label={
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <span>{detail.title}</span>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          (
                          {INPUT_TYPE_LABELS[detail.inputType] ??
                            detail.inputType}
                          )
                        </Typography>
                      </Box>
                    }
                    onDelete={() => handleRemoveDetail(detail.id)}
                    deleteIcon={<DeleteIcon />}
                    sx={{ justifyContent: 'space-between' }}
                  />
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
