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
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
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

import {
  TagChip,
  TagFilterSelect,
  ItemTagEditor,
  ImageLibraryTab,
} from '../../components/price-guide';
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
import { useTagList } from '../../hooks/useTags';

import type {
  OptionSummary,
  UpChargeSummary,
  AdditionalDetailFieldSummary,
  TagSummary,
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
  { value: 'size_picker', label: 'Size Picker (2D)' },
  { value: 'size_picker_3d', label: 'Size Picker (3D)' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'united_inch', label: 'United Inch' },
];

/** Size picker precision options */
const SIZE_PICKER_PRECISION_OPTIONS = [
  { value: 'inch', label: 'Inch' },
  { value: 'quarter_inch', label: '1/4 Inch' },
  { value: 'eighth_inch', label: '1/8 Inch' },
  { value: 'sixteenth_inch', label: '1/16 Inch' },
];

/** Input types that require additional configuration */
const TYPES_WITH_CONFIG = [
  'number',
  'currency',
  'picker',
  'size_picker',
  'size_picker_3d',
  'date',
  'time',
  'datetime',
  'united_inch',
];

/** Type for size picker configuration */
type SizePickerConfig = {
  precision: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minDepth?: number;
  maxDepth?: number;
};

/** Type for additional detail field data */
type AdditionalDetailFieldData = {
  title: string;
  inputType: string;
  isRequired: boolean;
  placeholder?: string;
  note?: string;
  defaultValue?: string;
  allowDecimal?: boolean;
  pickerValues?: string[];
  sizePickerConfig?: SizePickerConfig;
  unitedInchConfig?: { suffix?: string };
  dateDisplayFormat?: string;
};

type QuickAddAdditionalDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (data: AdditionalDetailFieldData) => Promise<void>;
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
  const [placeholder, setPlaceholder] = useState('');
  const [note, setNote] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [allowDecimal, setAllowDecimal] = useState(false);
  const [pickerValues, setPickerValues] = useState<string[]>([]);
  const [newPickerValue, setNewPickerValue] = useState('');
  const [sizePickerConfig, setSizePickerConfig] = useState<SizePickerConfig>({
    precision: 'inch',
  });
  const [unitedInchSuffix, setUnitedInchSuffix] = useState('');
  const [dateDisplayFormat, setDateDisplayFormat] = useState('');

  const resetForm = () => {
    setTitle('');
    setInputType('text');
    setIsRequired(false);
    setPlaceholder('');
    setNote('');
    setDefaultValue('');
    setAllowDecimal(false);
    setPickerValues([]);
    setNewPickerValue('');
    setSizePickerConfig({ precision: 'inch' });
    setUnitedInchSuffix('');
    setDateDisplayFormat('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const data: AdditionalDetailFieldData = {
      title: title.trim(),
      inputType,
      isRequired,
      placeholder: placeholder.trim() || undefined,
      note: note.trim() || undefined,
      defaultValue: defaultValue.trim() || undefined,
    };

    // Add type-specific config
    if (inputType === 'number' || inputType === 'currency') {
      data.allowDecimal = allowDecimal;
    }
    if (inputType === 'picker' && pickerValues.length > 0) {
      data.pickerValues = pickerValues;
    }
    if (inputType === 'size_picker' || inputType === 'size_picker_3d') {
      data.sizePickerConfig = sizePickerConfig;
    }
    if (inputType === 'united_inch' && unitedInchSuffix.trim()) {
      data.unitedInchConfig = { suffix: unitedInchSuffix.trim() };
    }
    if (
      (inputType === 'date' ||
        inputType === 'time' ||
        inputType === 'datetime') &&
      dateDisplayFormat.trim()
    ) {
      data.dateDisplayFormat = dateDisplayFormat.trim();
    }

    await onAdd(data);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddPickerValue = () => {
    if (
      newPickerValue.trim() &&
      !pickerValues.includes(newPickerValue.trim())
    ) {
      setPickerValues([...pickerValues, newPickerValue.trim()]);
      setNewPickerValue('');
    }
  };

  const handleRemovePickerValue = (value: string) => {
    setPickerValues(pickerValues.filter(v => v !== value));
  };

  const showConfig = TYPES_WITH_CONFIG.includes(inputType);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogTitle>Create New Additional Detail</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Basic Fields */}
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

          {/* General Optional Fields */}
          <TextField
            label="Placeholder"
            value={placeholder}
            onChange={e => setPlaceholder(e.target.value)}
            fullWidth
            helperText="Text shown when field is empty"
          />
          <TextField
            label="Helper Note"
            value={note}
            onChange={e => setNote(e.target.value)}
            fullWidth
            multiline
            rows={2}
            helperText="Instructions or context for this field"
          />
          <TextField
            label="Default Value"
            value={defaultValue}
            onChange={e => setDefaultValue(e.target.value)}
            fullWidth
            helperText="Pre-filled value when adding to estimate"
          />

          {/* Type-Specific Configuration */}
          {showConfig && (
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Type Configuration
              </Typography>

              {/* Number/Currency: allowDecimal */}
              {(inputType === 'number' || inputType === 'currency') && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={allowDecimal}
                      onChange={e => setAllowDecimal(e.target.checked)}
                    />
                  }
                  label="Allow decimal values"
                />
              )}

              {/* Picker: pickerValues */}
              {inputType === 'picker' && (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Picker Options
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add option..."
                      value={newPickerValue}
                      onChange={e => setNewPickerValue(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPickerValue();
                        }
                      }}
                      sx={{ flex: 1 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAddPickerValue}
                      disabled={!newPickerValue.trim()}
                    >
                      Add
                    </Button>
                  </Box>
                  {pickerValues.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mt: 1,
                      }}
                    >
                      {pickerValues.map(value => (
                        <Chip
                          key={value}
                          label={value}
                          onDelete={() => handleRemovePickerValue(value)}
                          size="small"
                        />
                      ))}
                    </Box>
                  )}
                  {pickerValues.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Add at least one option for the picker
                    </Typography>
                  )}
                </Stack>
              )}

              {/* Size Picker: precision and constraints */}
              {(inputType === 'size_picker' ||
                inputType === 'size_picker_3d') && (
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Precision"
                    value={sizePickerConfig.precision}
                    onChange={e =>
                      setSizePickerConfig({
                        ...sizePickerConfig,
                        precision: e.target.value,
                      })
                    }
                    fullWidth
                    size="small"
                  >
                    {SIZE_PICKER_PRECISION_OPTIONS.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Min Width"
                      type="number"
                      size="small"
                      value={sizePickerConfig.minWidth ?? ''}
                      onChange={e =>
                        setSizePickerConfig({
                          ...sizePickerConfig,
                          minWidth: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Max Width"
                      type="number"
                      size="small"
                      value={sizePickerConfig.maxWidth ?? ''}
                      onChange={e =>
                        setSizePickerConfig({
                          ...sizePickerConfig,
                          maxWidth: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Min Height"
                      type="number"
                      size="small"
                      value={sizePickerConfig.minHeight ?? ''}
                      onChange={e =>
                        setSizePickerConfig({
                          ...sizePickerConfig,
                          minHeight: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Max Height"
                      type="number"
                      size="small"
                      value={sizePickerConfig.maxHeight ?? ''}
                      onChange={e =>
                        setSizePickerConfig({
                          ...sizePickerConfig,
                          maxHeight: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  {inputType === 'size_picker_3d' && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Min Depth"
                        type="number"
                        size="small"
                        value={sizePickerConfig.minDepth ?? ''}
                        onChange={e =>
                          setSizePickerConfig({
                            ...sizePickerConfig,
                            minDepth: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        label="Max Depth"
                        type="number"
                        size="small"
                        value={sizePickerConfig.maxDepth ?? ''}
                        onChange={e =>
                          setSizePickerConfig({
                            ...sizePickerConfig,
                            maxDepth: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  )}
                </Stack>
              )}

              {/* United Inch: suffix */}
              {inputType === 'united_inch' && (
                <TextField
                  label="Suffix"
                  value={unitedInchSuffix}
                  onChange={e => setUnitedInchSuffix(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder='e.g., "UI"'
                  helperText="Text appended to the united inch value"
                />
              )}

              {/* Date/Time: format */}
              {(inputType === 'date' ||
                inputType === 'time' ||
                inputType === 'datetime') && (
                <TextField
                  label="Display Format"
                  value={dateDisplayFormat}
                  onChange={e => setDateDisplayFormat(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder={
                    inputType === 'date'
                      ? 'MM/dd/yyyy'
                      : inputType === 'time'
                        ? 'HH:mm'
                        : 'MM/dd/yyyy HH:mm'
                  }
                  helperText="Format string for displaying the value"
                />
              )}
            </Box>
          )}
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
            <ItemTagEditor
              entityType="OPTION"
              entityId={optionId ?? undefined}
              label="Tags"
              placeholder="Add tags..."
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
            <ItemTagEditor
              entityType="UPCHARGE"
              entityId={upchargeId ?? undefined}
              label="Tags"
              placeholder="Add tags..."
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
    data: Omit<
      AdditionalDetailFieldData,
      'title' | 'inputType' | 'isRequired'
    > & {
      title: string;
      inputType: string;
      isRequired: boolean;
    },
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
  const [placeholder, setPlaceholder] = useState('');
  const [note, setNote] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [allowDecimal, setAllowDecimal] = useState(false);
  const [pickerValues, setPickerValues] = useState<string[]>([]);
  const [newPickerValue, setNewPickerValue] = useState('');
  const [sizePickerConfig, setSizePickerConfig] = useState<SizePickerConfig>({
    precision: 'inch',
  });
  const [unitedInchSuffix, setUnitedInchSuffix] = useState('');
  const [dateDisplayFormat, setDateDisplayFormat] = useState('');

  const { data: detailData, isLoading: isLoadingDetail } =
    useAdditionalDetailDetail(detailId ?? '');

  // Sync form state when detail data loads
  useEffect(() => {
    if (detailData?.field) {
      setTitle(detailData.field.title);
      setInputType(detailData.field.inputType);
      setIsRequired(detailData.field.isRequired);
      setVersion(detailData.field.version);
      setPlaceholder(detailData.field.placeholder ?? '');
      setNote(detailData.field.note ?? '');
      setDefaultValue(detailData.field.defaultValue ?? '');
      setAllowDecimal(detailData.field.allowDecimal);
      setPickerValues(detailData.field.pickerValues ?? []);
      if (detailData.field.sizePickerConfig) {
        setSizePickerConfig(detailData.field.sizePickerConfig);
      } else {
        setSizePickerConfig({ precision: 'inch' });
      }
      setUnitedInchSuffix(detailData.field.unitedInchConfig?.suffix ?? '');
      setDateDisplayFormat(detailData.field.dateDisplayFormat ?? '');
    }
  }, [detailData]);

  const handleSubmit = async () => {
    if (!title.trim() || !detailId) return;
    const data: AdditionalDetailFieldData = {
      title: title.trim(),
      inputType,
      isRequired,
      placeholder: placeholder.trim() || undefined,
      note: note.trim() || undefined,
      defaultValue: defaultValue.trim() || undefined,
    };

    // Add type-specific config
    if (inputType === 'number' || inputType === 'currency') {
      data.allowDecimal = allowDecimal;
    }
    if (inputType === 'picker') {
      data.pickerValues = pickerValues.length > 0 ? pickerValues : undefined;
    }
    if (inputType === 'size_picker' || inputType === 'size_picker_3d') {
      data.sizePickerConfig = sizePickerConfig;
    }
    if (inputType === 'united_inch') {
      data.unitedInchConfig = unitedInchSuffix.trim()
        ? { suffix: unitedInchSuffix.trim() }
        : undefined;
    }
    if (
      inputType === 'date' ||
      inputType === 'time' ||
      inputType === 'datetime'
    ) {
      data.dateDisplayFormat = dateDisplayFormat.trim() || undefined;
    }

    await onSave(detailId, data, version);
  };

  const handleClose = () => {
    setTitle('');
    setInputType('text');
    setIsRequired(false);
    setPlaceholder('');
    setNote('');
    setDefaultValue('');
    setAllowDecimal(false);
    setPickerValues([]);
    setNewPickerValue('');
    setSizePickerConfig({ precision: 'inch' });
    setUnitedInchSuffix('');
    setDateDisplayFormat('');
    onClose();
  };

  const handleAddPickerValue = () => {
    if (
      newPickerValue.trim() &&
      !pickerValues.includes(newPickerValue.trim())
    ) {
      setPickerValues([...pickerValues, newPickerValue.trim()]);
      setNewPickerValue('');
    }
  };

  const handleRemovePickerValue = (value: string) => {
    setPickerValues(pickerValues.filter(v => v !== value));
  };

  const showConfig = TYPES_WITH_CONFIG.includes(inputType);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogTitle>Edit Additional Detail</DialogTitle>
      <DialogContent dividers>
        {isLoadingDetail ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Basic Fields */}
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

            {/* General Optional Fields */}
            <TextField
              label="Placeholder"
              value={placeholder}
              onChange={e => setPlaceholder(e.target.value)}
              fullWidth
              helperText="Text shown when field is empty"
            />
            <TextField
              label="Helper Note"
              value={note}
              onChange={e => setNote(e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="Instructions or context for this field"
            />
            <TextField
              label="Default Value"
              value={defaultValue}
              onChange={e => setDefaultValue(e.target.value)}
              fullWidth
              helperText="Pre-filled value when adding to estimate"
            />

            {/* Type-Specific Configuration */}
            {showConfig && (
              <Box
                sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mt: 2 }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Type Configuration
                </Typography>

                {/* Number/Currency: allowDecimal */}
                {(inputType === 'number' || inputType === 'currency') && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={allowDecimal}
                        onChange={e => setAllowDecimal(e.target.checked)}
                      />
                    }
                    label="Allow decimal values"
                  />
                )}

                {/* Picker: pickerValues */}
                {inputType === 'picker' && (
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Picker Options
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        placeholder="Add option..."
                        value={newPickerValue}
                        onChange={e => setNewPickerValue(e.target.value)}
                        onKeyPress={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPickerValue();
                          }
                        }}
                        sx={{ flex: 1 }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleAddPickerValue}
                        disabled={!newPickerValue.trim()}
                      >
                        Add
                      </Button>
                    </Box>
                    {pickerValues.length > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                          mt: 1,
                        }}
                      >
                        {pickerValues.map(value => (
                          <Chip
                            key={value}
                            label={value}
                            onDelete={() => handleRemovePickerValue(value)}
                            size="small"
                          />
                        ))}
                      </Box>
                    )}
                    {pickerValues.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Add at least one option for the picker
                      </Typography>
                    )}
                  </Stack>
                )}

                {/* Size Picker: precision and constraints */}
                {(inputType === 'size_picker' ||
                  inputType === 'size_picker_3d') && (
                  <Stack spacing={2}>
                    <TextField
                      select
                      label="Precision"
                      value={sizePickerConfig.precision}
                      onChange={e =>
                        setSizePickerConfig({
                          ...sizePickerConfig,
                          precision: e.target.value,
                        })
                      }
                      fullWidth
                      size="small"
                    >
                      {SIZE_PICKER_PRECISION_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Min Width"
                        type="number"
                        size="small"
                        value={sizePickerConfig.minWidth ?? ''}
                        onChange={e =>
                          setSizePickerConfig({
                            ...sizePickerConfig,
                            minWidth: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        label="Max Width"
                        type="number"
                        size="small"
                        value={sizePickerConfig.maxWidth ?? ''}
                        onChange={e =>
                          setSizePickerConfig({
                            ...sizePickerConfig,
                            maxWidth: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Min Height"
                        type="number"
                        size="small"
                        value={sizePickerConfig.minHeight ?? ''}
                        onChange={e =>
                          setSizePickerConfig({
                            ...sizePickerConfig,
                            minHeight: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        label="Max Height"
                        type="number"
                        size="small"
                        value={sizePickerConfig.maxHeight ?? ''}
                        onChange={e =>
                          setSizePickerConfig({
                            ...sizePickerConfig,
                            maxHeight: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                    </Box>
                    {inputType === 'size_picker_3d' && (
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          label="Min Depth"
                          type="number"
                          size="small"
                          value={sizePickerConfig.minDepth ?? ''}
                          onChange={e =>
                            setSizePickerConfig({
                              ...sizePickerConfig,
                              minDepth: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          label="Max Depth"
                          type="number"
                          size="small"
                          value={sizePickerConfig.maxDepth ?? ''}
                          onChange={e =>
                            setSizePickerConfig({
                              ...sizePickerConfig,
                              maxDepth: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    )}
                  </Stack>
                )}

                {/* United Inch: suffix */}
                {inputType === 'united_inch' && (
                  <TextField
                    label="Suffix"
                    value={unitedInchSuffix}
                    onChange={e => setUnitedInchSuffix(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder='e.g., "UI"'
                    helperText="Text appended to the united inch value"
                  />
                )}

                {/* Date/Time: format */}
                {(inputType === 'date' ||
                  inputType === 'time' ||
                  inputType === 'datetime') && (
                  <TextField
                    label="Display Format"
                    value={dateDisplayFormat}
                    onChange={e => setDateDisplayFormat(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder={
                      inputType === 'date'
                        ? 'MM/dd/yyyy'
                        : inputType === 'time'
                          ? 'HH:mm'
                          : 'MM/dd/yyyy HH:mm'
                    }
                    helperText="Format string for displaying the value"
                  />
                )}
              </Box>
            )}

            {/* Tags */}
            <ItemTagEditor
              entityType="ADDITIONAL_DETAIL"
              entityId={detailId ?? undefined}
              label="Tags"
              placeholder="Add tags..."
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
  tags?: string[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function OptionsTab({
  search,
  tags,
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
    tags: tags && tags.length > 0 ? tags : undefined,
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
              <TableCell>Tags</TableCell>
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
                  <TableCell>
                    {option.tags && option.tags.length > 0 ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {option.tags.slice(0, 3).map(tag => (
                          <TagChip key={tag.id} tag={tag} size="small" />
                        ))}
                        {option.tags.length > 3 && (
                          <Chip
                            label={`+${option.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
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
  tags?: string[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function UpChargesTab({
  search,
  tags,
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
    tags: tags && tags.length > 0 ? tags : undefined,
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
        Failed to load upcharges. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
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
              <TableCell>Tags</TableCell>
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
                      ? 'No upcharges match your search.'
                      : 'No upcharges found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              allItems.map((upcharge: UpChargeSummary) => (
                <TableRow key={upcharge.id} hover>
                  <TableCell>
                    <Tooltip
                      title={
                        upcharge.thumbnailImage
                          ? upcharge.thumbnailImage.name
                          : 'No image'
                      }
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          border: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {upcharge.thumbnailImage?.thumbnailUrl ? (
                          <Box
                            component="img"
                            src={upcharge.thumbnailImage.thumbnailUrl}
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
                      </Box>
                    </Tooltip>
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
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {upcharge.note ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {upcharge.tags && upcharge.tags.length > 0 ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {upcharge.tags.slice(0, 3).map(tag => (
                          <TagChip key={tag.id} tag={tag} size="small" />
                        ))}
                        {upcharge.tags.length > 3 && (
                          <Chip
                            label={`+${upcharge.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
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
  tags?: string[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

function AdditionalDetailsTab({
  search,
  tags,
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
    tags: tags && tags.length > 0 ? tags : undefined,
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
              <TableCell>Tags</TableCell>
              <TableCell align="center">Required</TableCell>
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
                  <TableCell>
                    {detail.tags && detail.tags.length > 0 ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {detail.tags.slice(0, 3).map(tag => (
                          <TagChip key={tag.id} tag={tag} size="small" />
                        ))}
                        {detail.tags.length > 3 && (
                          <Chip
                            label={`+${detail.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
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
  images: 3,
};
const TAB_NAMES = ['options', 'upcharges', 'details', 'images'];

export function LibraryPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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

  // Fetch tags for filtering
  const { data: tagsData } = useTagList();

  // Get selected tag objects for chip display
  const selectedTagObjects = useMemo(() => {
    if (selectedTags.length === 0 || !tagsData?.tags) return [];
    return selectedTags
      .map(id => tagsData.tags.find(t => t.id === id))
      .filter((t): t is TagSummary => t !== undefined);
  }, [selectedTags, tagsData?.tags]);

  // Check if any filters are active
  const hasFilters = search || selectedTags.length > 0;

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
      setSelectedTags([]); // Clear tags when switching tabs
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
    async (data: AdditionalDetailFieldData) => {
      await createAdditionalDetailMutation.mutateAsync(data);
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
      data: AdditionalDetailFieldData,
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
      case 3:
        return null; // Images tab has its own upload button
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
        {getAddButtonLabel() && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddClick}
          >
            {getAddButtonLabel()}
          </Button>
        )}
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
              <Tab label="Images" />
            </Tabs>
          </Box>

          {/* Search & Filter */}
          <Box
            sx={{ mt: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}
          >
            <TextField
              placeholder={`Search ${activeTab === 0 ? 'options' : activeTab === 1 ? 'upcharges' : activeTab === 2 ? 'additional details' : 'images'}...`}
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
            {tagsData?.tags && tagsData.tags.length > 0 && (
              <TagFilterSelect
                value={selectedTags}
                onChange={setSelectedTags}
                tags={tagsData.tags}
                label="Filter by Tags"
                minWidth={180}
              />
            )}
          </Box>

          {/* Active Filter Chips */}
          {hasFilters && (
            <Box
              sx={{
                mb: 2,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                Active filters:
              </Typography>
              {search && (
                <Chip
                  label={`Search: "${search}"`}
                  onDelete={handleClearSearch}
                  size="small"
                  variant="outlined"
                />
              )}
              {selectedTagObjects.map(tag => (
                <Chip
                  key={tag.id}
                  icon={<LocalOfferIcon sx={{ fontSize: 16 }} />}
                  label={tag.name}
                  onDelete={() =>
                    setSelectedTags(prev => prev.filter(id => id !== tag.id))
                  }
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: tag.color,
                    '& .MuiChip-icon': { color: tag.color },
                  }}
                />
              ))}
              <Button
                size="small"
                onClick={() => {
                  setSearch('');
                  setSelectedTags([]);
                }}
                sx={{ ml: 1 }}
              >
                Clear All
              </Button>
            </Box>
          )}

          {/* Tab Panels */}
          <TabPanel value={activeTab} index={0}>
            <OptionsTab
              search={search}
              tags={selectedTags}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <UpChargesTab
              search={search}
              tags={selectedTags}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <AdditionalDetailsTab
              search={search}
              tags={selectedTags}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <ImageLibraryTab search={search} />
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
