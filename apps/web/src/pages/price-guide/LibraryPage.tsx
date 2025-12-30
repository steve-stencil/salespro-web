/**
 * Price Guide Library Page.
 * Displays Options, UpCharges, and Additional Details in a tabbed interface.
 */

import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
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
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  useOptionList,
  useUpchargeList,
  useAdditionalDetailList,
  useCreateOption,
  useCreateUpcharge,
  useCreateAdditionalDetail,
  useOptionDetail,
  useUpdateOption,
  useUpchargeDetail,
  useUpdateUpcharge,
  useAdditionalDetailDetail,
  useUpdateAdditionalDetail,
} from '../../hooks/usePriceGuide';
import { filesApi } from '../../services/files';
import { priceGuideApi } from '../../services/price-guide';

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
// Edit Option Dialog
// ============================================================================

type EditOptionDialogProps = {
  open: boolean;
  optionId: string | null;
  onClose: () => void;
  onSave: (
    optionId: string,
    data: { name: string; brand?: string | null; itemCode?: string | null },
    version: number,
  ) => Promise<void>;
  isLoading: boolean;
};

function EditOptionDialog({
  open,
  optionId,
  onClose,
  onSave,
  isLoading,
}: EditOptionDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [version, setVersion] = useState(1);

  const { data: optionData, isLoading: isLoadingDetail } = useOptionDetail(
    optionId ?? '',
  );

  // Sync form state when option data loads
  useEffect(() => {
    if (optionData?.option) {
      setName(optionData.option.name);
      setBrand(optionData.option.brand ?? '');
      setItemCode(optionData.option.itemCode ?? '');
      setVersion(optionData.option.version);
    }
  }, [optionData]);

  const handleSubmit = async () => {
    if (!name.trim() || !optionId) return;
    await onSave(
      optionId,
      {
        name: name.trim(),
        brand: brand.trim() || null,
        itemCode: itemCode.trim() || null,
      },
      version,
    );
  };

  const handleClose = () => {
    setName('');
    setBrand('');
    setItemCode('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Option</DialogTitle>
      <DialogContent>
        {isLoadingDetail ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
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
              label="Brand"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              fullWidth
            />
            <TextField
              label="Item Code"
              value={itemCode}
              onChange={e => setItemCode(e.target.value)}
              fullWidth
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || isLoading || isLoadingDetail}
          startIcon={isLoading ? <CircularProgress size={16} /> : <EditIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Edit UpCharge Dialog
// ============================================================================

type EditUpChargeDialogProps = {
  open: boolean;
  upchargeId: string | null;
  onClose: () => void;
  onSave: (
    upchargeId: string,
    data: { name: string; note?: string | null },
    version: number,
  ) => Promise<void>;
  isLoading: boolean;
};

function EditUpChargeDialog({
  open,
  upchargeId,
  onClose,
  onSave,
  isLoading,
}: EditUpChargeDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [version, setVersion] = useState(1);

  const { data: upchargeData, isLoading: isLoadingDetail } = useUpchargeDetail(
    upchargeId ?? '',
  );

  // Sync form state when upcharge data loads
  useEffect(() => {
    if (upchargeData?.upcharge) {
      setName(upchargeData.upcharge.name);
      setNote(upchargeData.upcharge.note ?? '');
      setVersion(upchargeData.upcharge.version);
    }
  }, [upchargeData]);

  const handleSubmit = async () => {
    if (!name.trim() || !upchargeId) return;
    await onSave(
      upchargeId,
      {
        name: name.trim(),
        note: note.trim() || null,
      },
      version,
    );
  };

  const handleClose = () => {
    setName('');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit UpCharge</DialogTitle>
      <DialogContent>
        {isLoadingDetail ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
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
              label="Note"
              value={note}
              onChange={e => setNote(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || isLoading || isLoadingDetail}
          startIcon={isLoading ? <CircularProgress size={16} /> : <EditIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Edit Additional Detail Dialog
// ============================================================================

type EditAdditionalDetailDialogProps = {
  open: boolean;
  detailId: string | null;
  onClose: () => void;
  onSave: (
    detailId: string,
    data: { title: string; inputType: string; isRequired: boolean },
    version: number,
  ) => Promise<void>;
  isLoading: boolean;
};

function EditAdditionalDetailDialog({
  open,
  detailId,
  onClose,
  onSave,
  isLoading,
}: EditAdditionalDetailDialogProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [inputType, setInputType] = useState('text');
  const [isRequired, setIsRequired] = useState(false);
  const [version, setVersion] = useState(1);

  const { data: detailData, isLoading: isLoadingDetail } =
    useAdditionalDetailDetail(detailId ?? '');

  // Sync form state when detail data loads
  useEffect(() => {
    if (detailData?.field) {
      setTitle(detailData.field.title);
      setInputType(detailData.field.inputType);
      setIsRequired(detailData.field.isRequired);
      setVersion(detailData.field.version);
    }
  }, [detailData]);

  const handleSubmit = async () => {
    if (!title.trim() || !detailId) return;
    await onSave(
      detailId,
      {
        title: title.trim(),
        inputType,
        isRequired,
      },
      version,
    );
  };

  const handleClose = () => {
    setTitle('');
    setInputType('text');
    setIsRequired(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Additional Detail</DialogTitle>
      <DialogContent>
        {isLoadingDetail ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
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
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!title.trim() || isLoading || isLoadingDetail}
          startIcon={isLoading ? <CircularProgress size={16} /> : <EditIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Usage Count Badge Component (with lazy-loading tooltip)
// ============================================================================

type UsageCountBadgeProps = {
  count: number;
  label?: string;
  /** Item ID to fetch details for (lazy loads on hover) */
  itemId?: string;
  /** Type of item for fetching details */
  itemType?: 'option' | 'upcharge' | 'additionalDetail';
};

function UsageCountBadge({
  count,
  label = 'MSIs',
  itemId,
  itemType,
}: UsageCountBadgeProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [msiNames, setMsiNames] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Lazy fetch MSI names when hovering
  const { data: optionData } = useOptionDetail(
    itemType === 'option' && isHovered && itemId ? itemId : '',
  );
  const { data: upchargeData } = useUpchargeDetail(
    itemType === 'upcharge' && isHovered && itemId ? itemId : '',
  );
  const { data: additionalDetailData } = useAdditionalDetailDetail(
    itemType === 'additionalDetail' && isHovered && itemId ? itemId : '',
  );

  // Update MSI names when data loads
  useEffect(() => {
    let msis: Array<{ name: string }> | undefined;

    if (itemType === 'option' && optionData) {
      msis = optionData.option.usedByMSIs;
    } else if (itemType === 'upcharge' && upchargeData) {
      msis = upchargeData.upcharge.usedByMSIs;
    } else if (itemType === 'additionalDetail' && additionalDetailData) {
      msis = additionalDetailData.field.usedByMSIs;
    }

    if (msis && msis.length > 0) {
      setMsiNames(msis.map(m => m.name));
      setIsLoading(false);
    }
  }, [itemType, optionData, upchargeData, additionalDetailData]);

  const handleMouseEnter = () => {
    if (count > 0 && itemId && itemType && !msiNames) {
      setIsHovered(true);
      setIsLoading(true);
    }
  };

  const tooltipContent =
    count === 0 ? (
      `Not used by any ${label}`
    ) : isLoading ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={12} sx={{ color: 'inherit' }} />
        <Typography variant="caption">Loading...</Typography>
      </Box>
    ) : msiNames && msiNames.length > 0 ? (
      <Box sx={{ maxWidth: 300 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Used by {count} {label}:
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2, mt: 0.5 }}>
          {msiNames.slice(0, 10).map((name, idx) => (
            <li key={idx}>
              <Typography variant="caption">{name}</Typography>
            </li>
          ))}
          {msiNames.length > 10 && (
            <li>
              <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                +{msiNames.length - 10} more...
              </Typography>
            </li>
          )}
        </Box>
      </Box>
    ) : (
      `Used in ${count} ${label}`
    );

  return (
    <Tooltip title={tooltipContent}>
      <Chip
        label={count}
        size="small"
        color={count > 0 ? 'primary' : 'default'}
        variant={count > 0 ? 'filled' : 'outlined'}
        sx={{ minWidth: 40 }}
        onMouseEnter={handleMouseEnter}
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
              <TableCell>Brand</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Item Code</TableCell>
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
                      ? 'No options match your search.'
                      : 'No options found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              allItems.map((option: OptionSummary) => (
                <TableRow key={option.id} hover>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {option.brand ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {option.name}
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
                  <TableCell align="center">
                    <UsageCountBadge
                      count={option.linkedMsiCount}
                      itemId={option.id}
                      itemType="option"
                    />
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
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function UpChargesTab({
  search,
  onEdit,
  onDelete,
}: UpChargesTabProps): React.ReactElement {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const queryClient = useQueryClient();

  // Thumbnail upload state
  const [thumbnailUpchargeId, setThumbnailUpchargeId] = useState<string | null>(
    null,
  );
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

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

  // Thumbnail upload handlers
  const handleThumbnailClick = useCallback((upchargeId: string) => {
    setThumbnailUpchargeId(upchargeId);
    thumbnailInputRef.current?.click();
  }, []);

  const handleThumbnailFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !thumbnailUpchargeId) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('File must be an image');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        console.error('File must be less than 5MB');
        return;
      }

      setThumbnailUploading(true);
      try {
        // Upload the file
        const uploadResponse = await filesApi.uploadImage(file, {
          visibility: 'company',
          description: 'Upcharge product thumbnail',
        });

        // Update the upcharge thumbnail using the dedicated endpoint
        await priceGuideApi.updateUpchargeThumbnail(
          thumbnailUpchargeId,
          uploadResponse.file.id,
        );

        // Invalidate upcharge list to refresh thumbnails
        void queryClient.invalidateQueries({
          queryKey: ['price-guide', 'upcharges', 'list'],
        });
      } catch (err) {
        console.error('Failed to upload thumbnail:', err);
      } finally {
        setThumbnailUploading(false);
        setThumbnailUpchargeId(null);
        // Reset the input
        if (thumbnailInputRef.current) {
          thumbnailInputRef.current.value = '';
        }
      }
    },
    [thumbnailUpchargeId, queryClient],
  );

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load upcharges. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Hidden file input for thumbnail upload */}
      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/*"
        onChange={e => void handleThumbnailFileChange(e)}
        style={{ display: 'none' }}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isLoading ? (
          <Skeleton width={100} />
        ) : (
          `${totalCount} upcharge${totalCount !== 1 ? 's' : ''}`
        )}
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={60}>Image</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Note</TableCell>
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
                      ? 'No upcharges match your search.'
                      : 'No upcharges found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              allItems.map((upcharge: UpChargeSummary) => (
                <TableRow key={upcharge.id} hover>
                  <TableCell>
                    <Box
                      onClick={() => handleThumbnailClick(upcharge.id)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: 1,
                        borderColor: 'divider',
                        transition: 'all 0.2s',
                        position: 'relative',
                        '&:hover': {
                          borderColor: 'primary.main',
                          '& .thumbnail-overlay': {
                            opacity: 1,
                          },
                        },
                      }}
                    >
                      {thumbnailUploading &&
                      thumbnailUpchargeId === upcharge.id ? (
                        <CircularProgress size={20} color="primary" />
                      ) : upcharge.thumbnailUrl ? (
                        <Box
                          component="img"
                          src={upcharge.thumbnailUrl}
                          alt="Thumbnail"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <ImageIcon sx={{ color: 'grey.400', fontSize: 24 }} />
                      )}
                      <Box
                        className="thumbnail-overlay"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0, 0, 0, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <ImageIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {upcharge.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {upcharge.note ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <UsageCountBadge
                      count={upcharge.linkedMsiCount}
                      itemId={upcharge.id}
                      itemType="upcharge"
                    />
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
                          onClick={() => onEdit?.(upcharge.id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => onDelete?.(upcharge.id)}
                          disabled={upcharge.linkedMsiCount > 0}
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
                    <UsageCountBadge
                      count={detail.linkedMsiCount}
                      itemId={detail.id}
                      itemType="additionalDetail"
                    />
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

  // Edit dialog state
  const [showEditOptionDialog, setShowEditOptionDialog] = useState(false);
  const [showEditUpChargeDialog, setShowEditUpChargeDialog] = useState(false);
  const [showEditAdditionalDetailDialog, setShowEditAdditionalDetailDialog] =
    useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Get initial tab from URL param (default to 0 = options)
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam ? (TAB_MAP[tabParam] ?? 0) : 0;

  // Mutations for creating items
  const createOptionMutation = useCreateOption();
  const createUpchargeMutation = useCreateUpcharge();
  const createAdditionalDetailMutation = useCreateAdditionalDetail();

  // Mutations for updating items
  const updateOptionMutation = useUpdateOption();
  const updateUpchargeMutation = useUpdateUpcharge();
  const updateAdditionalDetailMutation = useUpdateAdditionalDetail();

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      const tabName = TAB_NAMES[newValue] ?? 'options';
      setSearchParams({ tab: tabName });
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

  const handleEdit = useCallback(
    (id: string) => {
      setEditingItemId(id);
      switch (activeTab) {
        case 0:
          setShowEditOptionDialog(true);
          break;
        case 1:
          setShowEditUpChargeDialog(true);
          break;
        case 2:
          setShowEditAdditionalDetailDialog(true);
          break;
      }
    },
    [activeTab],
  );

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

  // Update handlers
  const handleUpdateOption = useCallback(
    async (
      optionId: string,
      data: { name: string; brand?: string | null; itemCode?: string | null },
      version: number,
    ) => {
      await updateOptionMutation.mutateAsync({
        optionId,
        data: { ...data, version },
      });
      setShowEditOptionDialog(false);
      setEditingItemId(null);
    },
    [updateOptionMutation],
  );

  const handleUpdateUpCharge = useCallback(
    async (
      upchargeId: string,
      data: { name: string; note?: string | null },
      version: number,
    ) => {
      await updateUpchargeMutation.mutateAsync({
        upchargeId,
        data: { ...data, version },
      });
      setShowEditUpChargeDialog(false);
      setEditingItemId(null);
    },
    [updateUpchargeMutation],
  );

  const handleUpdateAdditionalDetail = useCallback(
    async (
      detailId: string,
      data: { title: string; inputType: string; isRequired: boolean },
      version: number,
    ) => {
      await updateAdditionalDetailMutation.mutateAsync({
        fieldId: detailId,
        data: { ...data, version },
      });
      setShowEditAdditionalDetailDialog(false);
      setEditingItemId(null);
    },
    [updateAdditionalDetailMutation],
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

      {/* Edit Option Dialog */}
      <EditOptionDialog
        open={showEditOptionDialog}
        optionId={editingItemId}
        onClose={() => {
          setShowEditOptionDialog(false);
          setEditingItemId(null);
        }}
        onSave={handleUpdateOption}
        isLoading={updateOptionMutation.isPending}
      />

      {/* Edit UpCharge Dialog */}
      <EditUpChargeDialog
        open={showEditUpChargeDialog}
        upchargeId={editingItemId}
        onClose={() => {
          setShowEditUpChargeDialog(false);
          setEditingItemId(null);
        }}
        onSave={handleUpdateUpCharge}
        isLoading={updateUpchargeMutation.isPending}
      />

      {/* Edit Additional Detail Dialog */}
      <EditAdditionalDetailDialog
        open={showEditAdditionalDetailDialog}
        detailId={editingItemId}
        onClose={() => {
          setShowEditAdditionalDetailDialog(false);
          setEditingItemId(null);
        }}
        onSave={handleUpdateAdditionalDetail}
        isLoading={updateAdditionalDetailMutation.isPending}
      />
    </Box>
  );
}
