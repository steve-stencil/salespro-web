/**
 * Link UpCharges Step Component.
 * Step 3 of the Create MSI Wizard.
 */

import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import FormControlLabel from '@mui/material/FormControlLabel';
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
import { useUpchargeList } from '../../../hooks/usePriceGuide';
import { useWizard } from '../../../pages/price-guide/CreateWizard';

import type { UpChargeSummary } from '@shared/types';

// ============================================================================
// UpCharge Card Component
// ============================================================================

type UpChargeCardProps = {
  upcharge: {
    id: string;
    name: string;
    disabledOptionIds: string[];
  };
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

export function LinkUpChargesStep(): React.ReactElement {
  const { state, addUpcharge, removeUpcharge, updateUpchargeDisabledOptions } =
    useWizard();
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
  } = useUpchargeList({
    search: debouncedSearch || undefined,
    limit: 20,
  });

  // Flatten pages
  const allUpcharges = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

  // Filter out already selected
  const availableUpcharges = useMemo(() => {
    const selectedIds = new Set(state.upcharges.map(u => u.id));
    return allUpcharges.filter(u => !selectedIds.has(u.id));
  }, [allUpcharges, state.upcharges]);

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

  const handleSelectUpcharge = useCallback(
    (upcharge: UpChargeSummary) => {
      addUpcharge({
        id: upcharge.id,
        name: upcharge.name,
        disabledOptionIds: [],
      });
    },
    [addUpcharge],
  );

  const handleRemoveUpcharge = useCallback(
    (upchargeId: string) => {
      removeUpcharge(upchargeId);
    },
    [removeUpcharge],
  );

  const handleToggleDisabledOption = useCallback(
    (upchargeId: string, optionId: string) => {
      const upcharge = state.upcharges.find(u => u.id === upchargeId);
      if (!upcharge) return;

      const isDisabled = upcharge.disabledOptionIds.includes(optionId);
      const newDisabledIds = isDisabled
        ? upcharge.disabledOptionIds.filter(id => id !== optionId)
        : [...upcharge.disabledOptionIds, optionId];

      updateUpchargeDisabledOptions(upchargeId, newDisabledIds);
    },
    [state.upcharges, updateUpchargeDisabledOptions],
  );

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Link UpCharges
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Search and select upcharges to link to this item. You can also configure
        which options each upcharge is disabled for.
      </Typography>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Left: Search & Select */}
        <Box sx={{ flex: 1 }}>
          <TextField
            placeholder="Search upcharges..."
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
              Failed to load upcharges.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : availableUpcharges.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  {search
                    ? 'No upcharges match your search.'
                    : allUpcharges.length === state.upcharges.length
                      ? 'All upcharges have been selected.'
                      : 'No upcharges available.'}
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {availableUpcharges.map(upcharge => (
                  <ListItem
                    key={upcharge.id}
                    component="div"
                    onClick={() => handleSelectUpcharge(upcharge)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <ListItemText
                      primary={upcharge.name}
                      secondary={upcharge.note ?? undefined}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => handleSelectUpcharge(upcharge)}
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

        {/* Right: Selected UpCharges */}
        <Box sx={{ width: 350 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected UpCharges ({state.upcharges.length})
          </Typography>

          {state.options.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }} icon={false}>
              <Typography variant="caption">
                Expand each upcharge to disable it for specific options.
              </Typography>
            </Alert>
          )}

          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {state.upcharges.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}
              >
                <Typography variant="body2" color="text.secondary">
                  No upcharges selected yet.
                  <br />
                  Click an upcharge to add it.
                </Typography>
              </Paper>
            ) : (
              state.upcharges.map(upcharge => (
                <UpChargeCard
                  key={upcharge.id}
                  upcharge={upcharge}
                  options={state.options}
                  onRemove={handleRemoveUpcharge}
                  onToggleDisabledOption={handleToggleDisabledOption}
                />
              ))
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
