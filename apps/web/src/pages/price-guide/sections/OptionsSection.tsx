/**
 * Options Section Component.
 * Handles linking/unlinking options for MSI.
 */

import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
import { useOptionList, useCreateOption } from '../../../hooks/usePriceGuide';

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
// Quick Add Dialog
// ============================================================================

type QuickAddDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, brand?: string) => void;
  isAdding: boolean;
};

function QuickAddDialog({
  open,
  onClose,
  onAdd,
  isAdding,
}: QuickAddDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');

  const handleSubmit = (): void => {
    if (name.trim()) {
      onAdd(name.trim(), brand.trim() || undefined);
    }
  };

  const handleClose = (): void => {
    setName('');
    setBrand('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Quick Add Option</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Option Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label="Brand (Optional)"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isAdding}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim() || isAdding}
          startIcon={isAdding ? <CircularProgress size={16} /> : <AddIcon />}
        >
          Add Option
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
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
  } = useOptionList({
    search: debouncedSearch || undefined,
    limit: 20,
  });

  const createMutation = useCreateOption();

  // Flatten pages
  const allOptions = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

  // Filter out already selected options
  const availableOptions = useMemo(() => {
    const selectedIds = new Set(state.options.map(o => o.id));
    return allOptions.filter(o => !selectedIds.has(o.id));
  }, [allOptions, state.options]);

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

  const handleSelectOption = useCallback(
    (option: OptionSummary) => {
      addOption({
        id: option.id,
        name: option.name,
        brand: option.brand,
      });
    },
    [addOption],
  );

  const handleRemoveOption = useCallback(
    (optionId: string) => {
      removeOption(optionId);
    },
    [removeOption],
  );

  const handleQuickAdd = useCallback(
    async (name: string, brand?: string) => {
      try {
        const response = await createMutation.mutateAsync({
          name,
          brand: brand ?? undefined,
        });
        addOption({
          id: response.option.id,
          name: response.option.name,
          brand: brand ?? null,
        });
        setShowQuickAdd(false);
      } catch {
        // Error handled by mutation
      }
    },
    [createMutation, addOption],
  );

  return (
    <Box sx={{ display: 'flex', gap: 3 }}>
      {/* Left: Search & Select */}
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            placeholder="Search options..."
            value={search}
            onChange={handleSearchChange}
            size="small"
            fullWidth
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
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowQuickAdd(true)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Quick Add
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load options. Please try again.
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
          ) : availableOptions.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ p: 2, textAlign: 'center' }}
            >
              {search
                ? 'No matching options found'
                : 'All options have been added'}
            </Typography>
          ) : (
            <List dense disablePadding>
              {availableOptions.map(option => (
                <ListItem
                  key={option.id}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => handleSelectOption(option)}
                >
                  <ListItemText
                    primary={option.name}
                    secondary={option.brand ?? undefined}
                  />
                  <IconButton size="small" color="primary">
                    <AddIcon fontSize="small" />
                  </IconButton>
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

      {/* Right: Selected Options */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Selected Options ({state.options.length})
        </Typography>
        {state.options.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover' }}
          >
            <Typography variant="body2" color="text.secondary">
              No options selected. At least one option is required.
            </Typography>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List dense disablePadding>
              {state.options.map(option => (
                <ListItem key={option.id}>
                  <ListItemText
                    primary={option.name}
                    secondary={option.brand ?? undefined}
                  />
                  {option.brand && (
                    <Chip
                      label={option.brand}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 1 }}
                    />
                  )}
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveOption(option.id)}
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

      {/* Quick Add Dialog */}
      <QuickAddDialog
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onAdd={(name, brand) => void handleQuickAdd(name, brand)}
        isAdding={createMutation.isPending}
      />
    </Box>
  );
}
