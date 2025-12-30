/**
 * Price Guide Library Page.
 * Displays Options, UpCharges, and Additional Details in a tabbed interface.
 */

import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { UpchargeDefaultPricingInline } from '../../components/price-guide/upcharge-pricing';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOfficesList } from '../../hooks/useOffices';
import {
  useOptionList,
  useUpchargeList,
  useAdditionalDetailList,
  useCreateOption,
  useCreateUpcharge,
  useCreateAdditionalDetail,
} from '../../hooks/usePriceGuide';

import type {
  OptionSummary,
  UpChargeSummary,
  AdditionalDetailFieldSummary,
} from '@shared/types';

// ============================================================================
// Tab Panel Component
// ============================================================================

type TabPanelProps = {
  children: React.ReactNode;
  value: number;
  index: number;
};

function TabPanel({
  children,
  value,
  index,
}: TabPanelProps): React.ReactElement | null {
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

// ============================================================================
// Quick Add Option Dialog
// ============================================================================

type QuickAddOptionDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, brand?: string) => Promise<void>;
  isLoading: boolean;
};

function QuickAddOptionDialog({
  open,
  onClose,
  onAdd,
  isLoading,
}: QuickAddOptionDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), brand.trim() || undefined);
    setName('');
    setBrand('');
  };

  const handleClose = () => {
    setName('');
    setBrand('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Option</DialogTitle>
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
            label="Brand (optional)"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <AddIcon />}
        >
          Add Option
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Quick Add UpCharge Dialog
// ============================================================================

type QuickAddUpChargeDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, note?: string) => Promise<void>;
  isLoading: boolean;
};

function QuickAddUpChargeDialog({
  open,
  onClose,
  onAdd,
  isLoading,
}: QuickAddUpChargeDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), note.trim() || undefined);
    setName('');
    setNote('');
  };

  const handleClose = () => {
    setName('');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New UpCharge</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="UpCharge Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <AddIcon />}
        >
          Add UpCharge
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Quick Add Additional Detail Dialog
// ============================================================================

/** Input type options for additional details */
const INPUT_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'picker', label: 'Picker (Dropdown)' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'datetime', label: 'Date & Time' },
];

type QuickAddAdditionalDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (
    title: string,
    inputType: string,
    isRequired: boolean,
  ) => Promise<void>;
  isLoading: boolean;
};

function QuickAddAdditionalDetailDialog({
  open,
  onClose,
  onAdd,
  isLoading,
}: QuickAddAdditionalDetailDialogProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [inputType, setInputType] = useState('text');
  const [isRequired, setIsRequired] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onAdd(title.trim(), inputType, isRequired);
    setTitle('');
    setInputType('text');
    setIsRequired(false);
  };

  const handleClose = () => {
    setTitle('');
    setInputType('text');
    setIsRequired(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Additional Detail</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            select
            label="Input Type"
            value={inputType}
            onChange={e => setInputType(e.target.value)}
            fullWidth
            required
          >
            {INPUT_TYPE_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={isRequired}
                onChange={e => setIsRequired(e.target.checked)}
              />
            }
            label="Required field"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!title.trim() || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <AddIcon />}
        >
          Add Detail
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Usage Count Badge Component
// ============================================================================

type UsageCountBadgeProps = {
  count: number;
  label?: string;
};

function UsageCountBadge({
  count,
  label = 'MSIs',
}: UsageCountBadgeProps): React.ReactElement {
  return (
    <Tooltip title={`Used in ${count} ${label}`}>
      <Chip
        label={count}
        size="small"
        color={count > 0 ? 'primary' : 'default'}
        variant={count > 0 ? 'filled' : 'outlined'}
        sx={{ minWidth: 40 }}
      />
    </Tooltip>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function TableRowSkeleton({
  columns,
}: {
  columns: number;
}): React.ReactElement {
  return (
    <TableRow>
      {[...Array(columns)].map((_, i) => (
        <TableCell key={i}>
          <Skeleton variant="text" width={i === 0 ? '60%' : '40%'} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ============================================================================
// Options Tab
// ============================================================================

type OptionsTabProps = {
  search: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function OptionsTab({
  search,
  onEdit,
  onDelete,
}: OptionsTabProps): React.ReactElement {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useOptionList({
    search: debouncedSearch || undefined,
    limit: 25,
  });

  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

  const totalCount = data?.pages[0]?.total ?? 0;

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

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load options. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isLoading ? (
          <Skeleton width={100} />
        ) : (
          `${totalCount} option${totalCount !== 1 ? 's' : ''}`
        )}
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell>Item Code</TableCell>
              <TableCell>Measurement</TableCell>
              <TableCell align="center">Used By</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRowSkeleton key={i} columns={6} />
              ))
            ) : allItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {search
                      ? 'No options match your search.'
                      : 'No options found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              allItems.map((option: OptionSummary) => (
                <TableRow key={option.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {option.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {option.brand ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {option.itemCode ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {option.measurementType ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <UsageCountBadge count={option.linkedMsiCount} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={0.5}
                      justifyContent="flex-end"
                    >
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => onEdit?.(option.id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => onDelete?.(option.id)}
                          disabled={option.linkedMsiCount > 0}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Load More Trigger */}
      <Box
        ref={loadMoreRef}
        sx={{
          height: 50,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isFetchingNextPage && <CircularProgress size={24} />}
        {!hasNextPage && allItems.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            End of list
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ============================================================================
// UpCharges Tab
// ============================================================================

type UpChargesTabProps = {
  search: string;
  offices: Array<{ id: string; name: string }>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function UpChargesTab({
  search,
  offices,
  onEdit,
  onDelete,
}: UpChargesTabProps): React.ReactElement {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useUpchargeList({
    search: debouncedSearch || undefined,
    limit: 25,
  });

  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

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

  // Transform items to match the expected shape
  const upcharges = useMemo(() => {
    return allItems.map((upcharge: UpChargeSummary) => ({
      id: upcharge.id,
      name: upcharge.name,
      note: upcharge.note,
      linkedMsiCount: upcharge.linkedMsiCount,
    }));
  }, [allItems]);

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load upcharges. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {search && allItems.length === 0 && !isLoading && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No upcharges match your search.
        </Typography>
      )}

      <UpchargeDefaultPricingInline
        upcharges={upcharges}
        offices={offices}
        isLoading={isLoading}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {/* Load More Trigger */}
      <Box
        ref={loadMoreRef}
        sx={{
          height: 50,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isFetchingNextPage && <CircularProgress size={24} />}
        {!hasNextPage && allItems.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            End of list
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ============================================================================
// Additional Details Tab
// ============================================================================

type AdditionalDetailsTabProps = {
  search: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function AdditionalDetailsTab({
  search,
  onEdit,
  onDelete,
}: AdditionalDetailsTabProps): React.ReactElement {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useAdditionalDetailList({
    search: debouncedSearch || undefined,
    limit: 25,
  });

  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data]);

  const totalCount = data?.pages[0]?.total ?? 0;

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

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load additional details. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isLoading ? (
          <Skeleton width={100} />
        ) : (
          `${totalCount} additional detail${totalCount !== 1 ? 's' : ''}`
        )}
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Input Type</TableCell>
              <TableCell align="center">Required</TableCell>
              <TableCell align="center">Used By</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRowSkeleton key={i} columns={5} />
              ))
            ) : allItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {search
                      ? 'No additional details match your search.'
                      : 'No additional details found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              allItems.map((detail: AdditionalDetailFieldSummary) => (
                <TableRow key={detail.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {detail.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={detail.inputType}
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {detail.isRequired ? (
                      <Chip label="Required" size="small" color="warning" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <UsageCountBadge count={detail.linkedMsiCount} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={0.5}
                      justifyContent="flex-end"
                    >
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => onEdit?.(detail.id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => onDelete?.(detail.id)}
                          disabled={detail.linkedMsiCount > 0}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Load More Trigger */}
      <Box
        ref={loadMoreRef}
        sx={{
          height: 50,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isFetchingNextPage && <CircularProgress size={24} />}
        {!hasNextPage && allItems.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            End of list
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// Map tab names to indices
const TAB_MAP: Record<string, number> = {
  options: 0,
  upcharges: 1,
  details: 2,
};
const TAB_NAMES = ['options', 'upcharges', 'details'];

export function LibraryPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showAddOptionDialog, setShowAddOptionDialog] = useState(false);
  const [showAddUpChargeDialog, setShowAddUpChargeDialog] = useState(false);
  const [showAddAdditionalDetailDialog, setShowAddAdditionalDetailDialog] =
    useState(false);

  // Get initial tab from URL param (default to 0 = options)
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam ? (TAB_MAP[tabParam] ?? 0) : 0;

  // Mutations for creating items
  const createOptionMutation = useCreateOption();
  const createUpchargeMutation = useCreateUpcharge();
  const createAdditionalDetailMutation = useCreateAdditionalDetail();

  // Fetch offices for pricing dialog
  const { data: officesData } = useOfficesList();
  const offices = useMemo(() => {
    if (!officesData?.offices) return [];
    return officesData.offices
      .filter(o => o.isActive)
      .map(o => ({ id: o.id, name: o.name }));
  }, [officesData]);

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setSearchParams({ tab: TAB_NAMES[newValue] });
      setSearch(''); // Clear search when switching tabs
    },
    [setSearchParams],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    [],
  );

  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const handleEdit = useCallback((id: string) => {
    // TODO: Open edit modal or navigate to edit page
    console.log('Edit:', id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    // TODO: Show confirmation dialog and delete
    console.log('Delete:', id);
  }, []);

  const handleAddClick = useCallback(() => {
    switch (activeTab) {
      case 0:
        // Options - open create dialog
        setShowAddOptionDialog(true);
        break;
      case 1:
        // UpCharges - open create dialog
        setShowAddUpChargeDialog(true);
        break;
      case 2:
        // Additional Details - open create dialog
        setShowAddAdditionalDetailDialog(true);
        break;
    }
  }, [activeTab]);

  const handleCreateOption = useCallback(
    async (name: string, brand?: string) => {
      await createOptionMutation.mutateAsync({ name, brand });
      setShowAddOptionDialog(false);
    },
    [createOptionMutation],
  );

  const handleCreateUpCharge = useCallback(
    async (name: string, note?: string) => {
      await createUpchargeMutation.mutateAsync({ name, note });
      setShowAddUpChargeDialog(false);
    },
    [createUpchargeMutation],
  );

  const handleCreateAdditionalDetail = useCallback(
    async (title: string, inputType: string, isRequired: boolean) => {
      await createAdditionalDetailMutation.mutateAsync({
        title,
        inputType,
        isRequired,
      });
      setShowAddAdditionalDetailDialog(false);
    },
    [createAdditionalDetailMutation],
  );

  const getAddButtonLabel = () => {
    switch (activeTab) {
      case 0:
        return 'New Option';
      case 1:
        return 'New UpCharge';
      case 2:
        return 'New Detail';
      default:
        return 'New';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LibraryBooksIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" component="h1">
              Library
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage shared options, upcharges, and additional details
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddClick}
        >
          {getAddButtonLabel()}
        </Button>
      </Box>

      {/* Content Card */}
      <Card>
        <CardContent>
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="Options" />
              <Tab label="UpCharges" />
              <Tab label="Additional Details" />
            </Tabs>
          </Box>

          {/* Search */}
          <Box sx={{ mt: 2, mb: 2 }}>
            <TextField
              placeholder={`Search ${activeTab === 0 ? 'options' : activeTab === 1 ? 'upcharges' : 'additional details'}...`}
              value={search}
              onChange={handleSearchChange}
              size="small"
              sx={{ width: 300 }}
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
          </Box>

          {/* Tab Panels */}
          <TabPanel value={activeTab} index={0}>
            <OptionsTab
              search={search}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <UpChargesTab
              search={search}
              offices={offices}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <AdditionalDetailsTab
              search={search}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabPanel>
        </CardContent>
      </Card>

      {/* Quick Add Option Dialog */}
      <QuickAddOptionDialog
        open={showAddOptionDialog}
        onClose={() => setShowAddOptionDialog(false)}
        onAdd={handleCreateOption}
        isLoading={createOptionMutation.isPending}
      />

      {/* Quick Add UpCharge Dialog */}
      <QuickAddUpChargeDialog
        open={showAddUpChargeDialog}
        onClose={() => setShowAddUpChargeDialog(false)}
        onAdd={handleCreateUpCharge}
        isLoading={createUpchargeMutation.isPending}
      />

      {/* Quick Add Additional Detail Dialog */}
      <QuickAddAdditionalDetailDialog
        open={showAddAdditionalDetailDialog}
        onClose={() => setShowAddAdditionalDetailDialog(false)}
        onAdd={handleCreateAdditionalDetail}
        isLoading={createAdditionalDetailMutation.isPending}
      />
    </Box>
  );
}
