/**
 * Price Types Management Page.
 * Allows managing price type codes and office assignments.
 */

import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  PARENT_PRICE_TYPE_CODES,
  PARENT_PRICE_TYPE_LABELS,
} from '@shared/types';
import { useState, useCallback, useMemo } from 'react';

import { useOfficesList } from '../../hooks/useOffices';
import {
  usePriceTypes,
  usePriceType,
  useCreatePriceType,
  useUpdatePriceType,
  useDeletePriceType,
  useGeneratePriceTypes,
  useRemovePriceTypeFromOffice,
  useAssignPriceTypeToOffice,
} from '../../hooks/usePriceGuide';

import type { ParentPriceTypeCode, PriceType } from '@shared/types';

// ============================================================================
// Generate Defaults Dialog Component
// ============================================================================

type GenerateDefaultsDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Dialog for generating default price types with office assignments.
 */
function GenerateDefaultsDialog({
  open,
  onClose,
}: GenerateDefaultsDialogProps): React.ReactElement {
  const { data: officesData, isLoading: officesLoading } = useOfficesList();
  const generateMutation = useGeneratePriceTypes();

  const [selectedParentCodes, setSelectedParentCodes] = useState<
    Set<ParentPriceTypeCode>
  >(new Set(['MATERIAL', 'LABOR', 'TAX']));
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<Set<string>>(
    new Set(),
  );

  const offices = useMemo(
    () => officesData?.offices ?? [],
    [officesData?.offices],
  );

  const handleSelectAllOffices = useCallback(() => {
    setSelectedOfficeIds(new Set(offices.map(o => o.id)));
  }, [offices]);

  const handleToggleParentCode = (code: ParentPriceTypeCode) => {
    setSelectedParentCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleToggleOffice = (officeId: string) => {
    setSelectedOfficeIds(prev => {
      const next = new Set(prev);
      if (next.has(officeId)) {
        next.delete(officeId);
      } else {
        next.add(officeId);
      }
      return next;
    });
  };

  const handleToggleAllOffices = () => {
    if (selectedOfficeIds.size === offices.length) {
      setSelectedOfficeIds(new Set());
    } else {
      setSelectedOfficeIds(new Set(offices.map(o => o.id)));
    }
  };

  const handleGenerate = async () => {
    await generateMutation.mutateAsync({
      parentCodes: Array.from(selectedParentCodes),
      officeIds: Array.from(selectedOfficeIds),
    });
    onClose();
  };

  const allOfficesSelected = selectedOfficeIds.size === offices.length;
  const someOfficesSelected =
    selectedOfficeIds.size > 0 && selectedOfficeIds.size < offices.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon color="primary" />
        Generate Default Price Types
        <IconButton
          onClick={onClose}
          sx={{ ml: 'auto' }}
          aria-label="close"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Parent Codes Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Select price types to create:
            </Typography>
            <Stack spacing={1}>
              {PARENT_PRICE_TYPE_CODES.map(code => (
                <FormControlLabel
                  key={code}
                  control={
                    <Checkbox
                      checked={selectedParentCodes.has(code)}
                      onChange={() => handleToggleParentCode(code)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>{PARENT_PRICE_TYPE_LABELS[code]}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        (parent: {code})
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Offices Selection */}
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Typography variant="subtitle2">Assign to offices:</Typography>
              {!officesLoading && (
                <Button size="small" onClick={handleSelectAllOffices}>
                  Select All
                </Button>
              )}
            </Box>

            {officesLoading ? (
              <Stack spacing={1}>
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} height={32} />
                ))}
              </Stack>
            ) : offices.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                No offices found. Create offices first to assign price types.
              </Alert>
            ) : (
              <Stack spacing={0}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allOfficesSelected}
                      indeterminate={someOfficesSelected}
                      onChange={handleToggleAllOffices}
                    />
                  }
                  label={
                    <Typography fontWeight="medium">Select All</Typography>
                  }
                />
                <Divider sx={{ my: 1 }} />
                {offices.map(office => (
                  <FormControlLabel
                    key={office.id}
                    control={
                      <Checkbox
                        checked={selectedOfficeIds.has(office.id)}
                        onChange={() => handleToggleOffice(office.id)}
                      />
                    }
                    label={office.name}
                    sx={{ ml: 2 }}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void handleGenerate()}
          disabled={
            selectedParentCodes.size === 0 ||
            selectedOfficeIds.size === 0 ||
            generateMutation.isPending
          }
          startIcon={
            generateMutation.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AutoAwesomeIcon />
            )
          }
        >
          {generateMutation.isPending ? 'Generating...' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Create/Edit Price Type Dialog
// ============================================================================

type PriceTypeDialogProps = {
  open: boolean;
  onClose: () => void;
  priceType?: PriceType | null;
};

/**
 * Dialog for creating or editing a price type.
 */
function PriceTypeDialog({
  open,
  onClose,
  priceType,
}: PriceTypeDialogProps): React.ReactElement {
  const createMutation = useCreatePriceType();
  const updateMutation = useUpdatePriceType();

  const isEdit = !!priceType;

  const [code, setCode] = useState(priceType?.code ?? '');
  const [name, setName] = useState(priceType?.name ?? '');
  const [parentCode, setParentCode] = useState<ParentPriceTypeCode>(
    priceType?.parentCode ?? 'OTHER',
  );

  const handleSubmit = async () => {
    if (priceType) {
      await updateMutation.mutateAsync({
        priceTypeId: priceType.id,
        data: { name, parentCode },
      });
    } else {
      await createMutation.mutateAsync({
        code: code.toUpperCase(),
        name,
        parentCode,
      });
    }
    onClose();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit ? 'Edit Price Type' : 'Add Price Type'}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="close"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            disabled={isEdit}
            required
            inputProps={{ maxLength: 50 }}
            helperText={
              isEdit
                ? 'Code cannot be changed after creation'
                : 'Unique identifier (e.g., ROOFING_LABOR)'
            }
          />

          <TextField
            label="Display Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            inputProps={{ maxLength: 255 }}
            helperText="Name shown in the UI (e.g., Roofing Labor)"
          />

          <FormControl fullWidth required>
            <InputLabel>Parent Code</InputLabel>
            <Select<ParentPriceTypeCode>
              value={parentCode}
              onChange={e => setParentCode(e.target.value)}
              label="Parent Code"
            >
              {PARENT_PRICE_TYPE_CODES.map(pc => (
                <MenuItem key={pc} value={pc}>
                  {PARENT_PRICE_TYPE_LABELS[pc]}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Used for cross-company reporting aggregation
            </Typography>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!code || !name || isPending}
          startIcon={
            isPending ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {isPending ? 'Saving...' : isEdit ? 'Save' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Office Assignments Expandable Row
// ============================================================================

type OfficeAssignmentsRowProps = {
  priceType: PriceType;
};

/**
 * Expandable row showing office assignments for a price type.
 */
function OfficeAssignmentsRow({
  priceType,
}: OfficeAssignmentsRowProps): React.ReactElement {
  const { data: priceTypeDetail, isLoading } = usePriceType(priceType.id);
  const { data: officesData } = useOfficesList();
  const assignMutation = useAssignPriceTypeToOffice();
  const removeMutation = useRemovePriceTypeFromOffice();

  const offices = officesData?.offices ?? [];
  const assignments = priceTypeDetail?.priceType.officeAssignments ?? [];
  const assignmentMap = new Map(assignments.map(a => [a.officeId, a]));

  const handleToggle = async (officeId: string) => {
    const assignment = assignmentMap.get(officeId);
    if (assignment) {
      await removeMutation.mutateAsync({
        priceTypeId: priceType.id,
        officeId,
      });
    } else {
      await assignMutation.mutateAsync({
        priceTypeId: priceType.id,
        officeId,
        data: {},
      });
    }
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={5}>
          <Skeleton height={40} />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={5} sx={{ py: 2, bgcolor: 'action.hover' }}>
        <Typography variant="subtitle2" gutterBottom>
          Office Assignments for "{priceType.name}"
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Office</TableCell>
              <TableCell align="center">Enabled</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {offices.map(office => {
              const assignment = assignmentMap.get(office.id);
              const isEnabled = !!assignment;

              return (
                <TableRow key={office.id}>
                  <TableCell>{office.name}</TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={isEnabled}
                      onChange={() => void handleToggle(office.id)}
                      disabled={
                        assignMutation.isPending || removeMutation.isPending
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Price Types Table Row
// ============================================================================

type PriceTypeRowProps = {
  priceType: PriceType;
  onEdit: (priceType: PriceType) => void;
  onDelete: (priceType: PriceType) => void;
};

/**
 * Table row for a single price type with expand/collapse functionality.
 */
function PriceTypeRow({
  priceType,
  onEdit,
  onDelete,
}: PriceTypeRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'collapse' : 'expand'}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="subtitle2" fontFamily="monospace">
            {priceType.code}
          </Typography>
        </TableCell>
        <TableCell>{priceType.name}</TableCell>
        <TableCell>
          <Chip
            label={priceType.parentLabel}
            size="small"
            variant="outlined"
            color="primary"
          />
        </TableCell>
        <TableCell>
          <Tooltip
            title={`${priceType.officeCount} of ${priceType.totalOffices} offices`}
          >
            <Chip
              label={`${priceType.officeCount}/${priceType.totalOffices}`}
              size="small"
              color={
                priceType.officeCount === priceType.totalOffices
                  ? 'success'
                  : priceType.officeCount > 0
                    ? 'warning'
                    : 'default'
              }
            />
          </Tooltip>
        </TableCell>
        <TableCell align="right">
          <IconButton
            size="small"
            onClick={() => onEdit(priceType)}
            aria-label="edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(priceType)}
            aria-label="delete"
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          colSpan={6}
          sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}
        >
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <OfficeAssignmentsRow priceType={priceType} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Price Types management page.
 * Allows creating, editing, and managing price type codes and their office assignments.
 */
export function PriceTypesPage(): React.ReactElement {
  const { data: priceTypesData, isLoading, error } = usePriceTypes();
  const deleteMutation = useDeletePriceType();

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPriceType, setSelectedPriceType] = useState<PriceType | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [priceTypeToDelete, setPriceTypeToDelete] = useState<PriceType | null>(
    null,
  );

  const priceTypes = priceTypesData?.priceTypes ?? [];

  const handleEdit = (priceType: PriceType) => {
    setSelectedPriceType(priceType);
    setEditDialogOpen(true);
  };

  const handleDelete = (priceType: PriceType) => {
    setPriceTypeToDelete(priceType);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (priceTypeToDelete) {
      await deleteMutation.mutateAsync(priceTypeToDelete.id);
      setDeleteConfirmOpen(false);
      setPriceTypeToDelete(null);
    }
  };

  const handleAddNew = () => {
    setSelectedPriceType(null);
    setEditDialogOpen(true);
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
          <LocalOfferIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" component="h1">
              Price Types
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage price type codes and office assignments
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setGenerateDialogOpen(true)}
          >
            Generate Defaults
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddNew}
          >
            Add Price Type
          </Button>
        </Stack>
      </Box>

      {/* Main Content Card */}
      <Card>
        <CardContent>
          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load price types. Please try again.
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <Stack spacing={1}>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} height={52} />
              ))}
            </Stack>
          )}

          {/* Empty State */}
          {!isLoading && !error && priceTypes.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LocalOfferIcon
                sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }}
              />
              <Typography variant="body1" color="text.secondary">
                No price types configured yet.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click "Generate Defaults" to create standard price types, or add
                a custom one.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => setGenerateDialogOpen(true)}
              >
                Generate Defaults
              </Button>
            </Box>
          )}

          {/* Price Types Table */}
          {!isLoading && priceTypes.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={48} />
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Parent</TableCell>
                  <TableCell>Offices</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {priceTypes.map(pt => (
                  <PriceTypeRow
                    key={pt.id}
                    priceType={pt}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Defaults Dialog */}
      <GenerateDefaultsDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
      />

      {/* Create/Edit Dialog */}
      <PriceTypeDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedPriceType(null);
        }}
        priceType={selectedPriceType}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Price Type</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the price type "
            {priceTypeToDelete?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will remove it from all office assignments. Existing price data
            will not be affected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleConfirmDelete()}
            disabled={deleteMutation.isPending}
            startIcon={
              deleteMutation.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
