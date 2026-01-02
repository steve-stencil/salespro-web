/**
 * Bulk Edit Dialog Component.
 * Allows bulk updating category or offices for selected MSIs.
 */

import EditIcon from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { flattenCategoryTree } from '@shared/utils';
import { useState, useCallback, useMemo } from 'react';

import { useOfficesList } from '../../hooks/useOffices';
import { useCategoryTree } from '../../hooks/usePriceGuide';

// ============================================================================
// Types
// ============================================================================

type BulkEditDialogProps = {
  open: boolean;
  selectedIds: string[];
  onClose: () => void;
  onUpdate: (options: BulkEditOptions) => Promise<BulkEditResult>;
};

export type BulkEditOptions = {
  categoryId?: string;
  addOfficeIds?: string[];
  removeOfficeIds?: string[];
};

export type BulkEditResult = {
  updated: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
};

type EditAction = 'category' | 'offices';
type OfficeAction = 'add' | 'remove' | 'set';

// ============================================================================
// Main Component
// ============================================================================

export function BulkEditDialog({
  open,
  selectedIds,
  onClose,
  onUpdate,
}: BulkEditDialogProps): React.ReactElement {
  const [action, setAction] = useState<EditAction>('category');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [officeAction, setOfficeAction] = useState<OfficeAction>('add');
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkEditResult | null>(null);

  // Queries
  const { data: categoryData, isLoading: isLoadingCategories } =
    useCategoryTree();
  const { data: officesData, isLoading: isLoadingOffices } = useOfficesList();

  // Flatten categories for autocomplete
  const flatCategories = useMemo(() => {
    if (!categoryData?.categories) return [];
    return flattenCategoryTree(categoryData.categories).map(cat => ({
      id: cat.id,
      name: cat.name,
      depth: cat.depth,
      fullPath: Array(cat.depth).fill('').join('  ') + cat.name,
    }));
  }, [categoryData]);

  // Get selected category
  const selectedCategory = useMemo(() => {
    return flatCategories.find(c => c.id === categoryId) ?? null;
  }, [flatCategories, categoryId]);

  const handleClose = useCallback(() => {
    if (isUpdating) return;
    setAction('category');
    setCategoryId(null);
    setOfficeAction('add');
    setSelectedOfficeIds([]);
    setProgress(0);
    setResult(null);
    onClose();
  }, [isUpdating, onClose]);

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    setProgress(0);
    setResult(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 5, 95));
    }, 100);

    try {
      const options: BulkEditOptions = {};

      if (action === 'category' && categoryId) {
        options.categoryId = categoryId;
      } else if (action === 'offices' && selectedOfficeIds.length > 0) {
        if (officeAction === 'add') {
          options.addOfficeIds = selectedOfficeIds;
        } else if (officeAction === 'remove') {
          options.removeOfficeIds = selectedOfficeIds;
        }
        // 'set' would replace all offices (not implemented here)
      }

      const updateResult = await onUpdate(options);
      clearInterval(progressInterval);
      setProgress(100);
      setResult(updateResult);

      if (updateResult.failed === 0) {
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setResult({
        updated: 0,
        failed: selectedIds.length,
        errors: [{ id: 'all', error: 'Bulk update operation failed' }],
      });
      console.error('Bulk update failed:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [
    action,
    categoryId,
    handleClose,
    officeAction,
    selectedOfficeIds,
    selectedIds.length,
    onUpdate,
  ]);

  const isValid = useMemo(() => {
    if (action === 'category') {
      return categoryId !== null;
    }
    // action === 'offices'
    return selectedOfficeIds.length > 0;
  }, [action, categoryId, selectedOfficeIds]);

  const count = selectedIds.length;
  const isLoading = isLoadingCategories || isLoadingOffices;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon color="primary" />
        Edit {count} Item{count !== 1 ? 's' : ''}
      </DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !result ? (
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Action Selection */}
            <FormControl>
              <FormLabel>What do you want to update?</FormLabel>
              <RadioGroup
                value={action}
                onChange={e => setAction(e.target.value as EditAction)}
              >
                <FormControlLabel
                  value="category"
                  control={<Radio />}
                  label="Move to different category"
                  disabled={isUpdating}
                />
                <FormControlLabel
                  value="offices"
                  control={<Radio />}
                  label="Update office assignments"
                  disabled={isUpdating}
                />
              </RadioGroup>
            </FormControl>

            {/* Category Selection */}
            {action === 'category' && (
              <Autocomplete
                options={flatCategories}
                value={selectedCategory}
                onChange={(_, value) => setCategoryId(value?.id ?? null)}
                getOptionLabel={option => option.name}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="New Category"
                    placeholder="Select a category"
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box sx={{ pl: option.depth * 2 }}>{option.name}</Box>
                  </li>
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                disabled={isUpdating}
              />
            )}

            {/* Office Selection */}
            {action === 'offices' && (
              <>
                <FormControl>
                  <FormLabel>Office Action</FormLabel>
                  <RadioGroup
                    row
                    value={officeAction}
                    onChange={e =>
                      setOfficeAction(e.target.value as OfficeAction)
                    }
                  >
                    <FormControlLabel
                      value="add"
                      control={<Radio />}
                      label="Add to offices"
                      disabled={isUpdating}
                    />
                    <FormControlLabel
                      value="remove"
                      control={<Radio />}
                      label="Remove from offices"
                      disabled={isUpdating}
                    />
                  </RadioGroup>
                </FormControl>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Select Offices
                  </Typography>
                  <Stack spacing={0.5}>
                    {officesData?.offices.map(office => (
                      <FormControlLabel
                        key={office.id}
                        control={
                          <Checkbox
                            checked={selectedOfficeIds.includes(office.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedOfficeIds(prev => [
                                  ...prev,
                                  office.id,
                                ]);
                              } else {
                                setSelectedOfficeIds(prev =>
                                  prev.filter(id => id !== office.id),
                                );
                              }
                            }}
                            disabled={isUpdating}
                          />
                        }
                        label={office.name}
                      />
                    ))}
                  </Stack>
                </Box>
              </>
            )}

            {isUpdating && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Updating items...
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            )}
          </Stack>
        ) : (
          <>
            {result.failed === 0 ? (
              <Alert severity="success">
                Successfully updated {result.updated} item
                {result.updated !== 1 ? 's' : ''}.
              </Alert>
            ) : (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Updated {result.updated} item{result.updated !== 1 ? 's' : ''}
                  . Failed to update {result.failed} item
                  {result.failed !== 1 ? 's' : ''}.
                </Alert>

                {result.errors.length > 0 && (
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Errors:
                    </Typography>
                    {result.errors.slice(0, 5).map((err, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        color="error"
                        sx={{ mb: 0.5 }}
                      >
                        • {err.error}
                      </Typography>
                    ))}
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleUpdate()}
              disabled={!isValid || isUpdating}
              startIcon={
                isUpdating ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <EditIcon />
                )
              }
            >
              {isUpdating
                ? 'Updating...'
                : `Update ${count} Item${count !== 1 ? 's' : ''}`}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
