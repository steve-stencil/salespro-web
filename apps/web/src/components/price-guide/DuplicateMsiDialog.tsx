/**
 * Duplicate MSI Dialog.
 * Creates a copy of an existing MSI with a new name.
 *
 * Note: Options are always included since at least one is required. See ADR-003.
 */

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useEffect } from 'react';

import { useCreateMsi } from '../../hooks/usePriceGuide';

import type { MeasureSheetItemDetail, CreateMsiRequest } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type DuplicateMsiDialogProps = {
  open: boolean;
  msi: MeasureSheetItemDetail;
  onClose: () => void;
  onSuccess: (newMsiId: string) => void;
};

// ============================================================================
// Main Component
// ============================================================================

export function DuplicateMsiDialog({
  open,
  msi,
  onClose,
  onSuccess,
}: DuplicateMsiDialogProps): React.ReactElement {
  const [newName, setNewName] = useState('');
  // Options are always included (required). See ADR-003.
  const [includeUpcharges, setIncludeUpcharges] = useState(true);
  const [includeAdditionalDetails, setIncludeAdditionalDetails] =
    useState(true);

  const createMutation = useCreateMsi();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNewName(`${msi.name} (Copy)`);
      setIncludeUpcharges(true);
      setIncludeAdditionalDetails(true);
    }
  }, [open, msi.name]);

  const isValid = newName.trim().length > 0;

  const handleDuplicate = useCallback(async () => {
    if (!isValid) return;

    const request: CreateMsiRequest = {
      name: newName.trim(),
      categoryId: msi.category.id,
      measurementType: msi.measurementType,
      note: msi.note ?? undefined,
      defaultQty: msi.defaultQty,
      showSwitch: msi.showSwitch,
      tagTitle: msi.tagTitle ?? undefined,
      tagRequired: msi.tagRequired,
      tagPickerOptions: msi.tagPickerOptions ?? undefined,
      officeIds: msi.offices.map(o => o.id),
      // Options are always included (required). See ADR-003.
      optionIds: msi.options.map(o => o.optionId),
      upchargeIds: includeUpcharges
        ? msi.upcharges.map(u => u.upchargeId)
        : undefined,
      additionalDetailFieldIds: includeAdditionalDetails
        ? msi.additionalDetails.map(d => d.fieldId)
        : undefined,
    };

    try {
      const result = await createMutation.mutateAsync(request);
      onSuccess(result.item.id);
    } catch (error) {
      console.error('Failed to duplicate MSI:', error);
    }
  }, [
    isValid,
    newName,
    msi,
    includeUpcharges,
    includeAdditionalDetails,
    createMutation,
    onSuccess,
  ]);

  const handleClose = useCallback(() => {
    if (createMutation.isPending) return;
    onClose();
  }, [createMutation.isPending, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ContentCopyIcon color="primary" />
        Duplicate Measure Sheet Item
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create a copy of &quot;{msi.name}&quot; with all its settings.
        </Typography>

        <Stack spacing={3}>
          <TextField
            label="New Item Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            fullWidth
            required
            error={newName.length > 0 && !isValid}
            helperText={
              newName.length > 0 && !isValid ? 'Name is required' : undefined
            }
            disabled={createMutation.isPending}
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Include in duplicate:
            </Typography>
            <Stack>
              <FormControlLabel
                control={<Checkbox checked={true} disabled={true} />}
                label={`Options (${msi.options.length}) — required`}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeUpcharges}
                    onChange={e => setIncludeUpcharges(e.target.checked)}
                    disabled={createMutation.isPending}
                  />
                }
                label={`UpCharges (${msi.upcharges.length})`}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeAdditionalDetails}
                    onChange={e =>
                      setIncludeAdditionalDetails(e.target.checked)
                    }
                    disabled={createMutation.isPending}
                  />
                }
                label={`Additional Details (${msi.additionalDetails.length})`}
              />
            </Stack>
          </Box>

          <Alert severity="info">
            Pricing data will not be copied. You can configure pricing after the
            duplicate is created.
          </Alert>
        </Stack>

        {createMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to create duplicate. Please try again.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleDuplicate()}
          disabled={!isValid || createMutation.isPending}
          startIcon={
            createMutation.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <ContentCopyIcon />
            )
          }
        >
          {createMutation.isPending ? 'Creating...' : 'Create Duplicate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
