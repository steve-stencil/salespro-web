/**
 * UpCharge Pricing Dialog Component.
 * Modal dialog for editing default upcharge pricing configuration.
 * Override pricing is configured at the Option level.
 */

import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo, useEffect } from 'react';

import {
  useUpchargePricing,
  useUpdateUpchargeDefaultPrices,
  usePriceTypes,
} from '../../../hooks/usePriceGuide';

import { DefaultPricingGrid } from './DefaultPricingGrid';
import { transformToConfig, transformToApiRequest } from './utils';

import type { UpChargePriceTypeConfig } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type Office = {
  id: string;
  name: string;
};

type UpChargePricingDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** ID of the upcharge to edit */
  upchargeId: string;
  /** Upcharge name for display */
  upchargeName: string;
  /** Available offices */
  offices: Office[];
  /** Sample option for preview (optional) */
  sampleOption?: {
    id: string;
    name: string;
    prices: Record<string, number>;
  };
};

// ============================================================================
// Component
// ============================================================================

export function UpChargePricingDialog({
  open,
  onClose,
  upchargeId,
  upchargeName,
  offices,
  sampleOption,
}: UpChargePricingDialogProps): React.ReactElement {
  // Queries
  const {
    data: pricingData,
    isLoading: isLoadingPricing,
    error: pricingError,
  } = useUpchargePricing(upchargeId);
  const { data: priceTypesData, isLoading: isLoadingPriceTypes } =
    usePriceTypes();

  // Mutations
  const updateDefaultPricesMutation = useUpdateUpchargeDefaultPrices();

  // Local state for default configs
  const [defaultConfigs, setDefaultConfigs] = useState<
    UpChargePriceTypeConfig[]
  >([]);

  // Changes tracking
  const [hasChanges, setHasChanges] = useState(false);

  // Get price types
  const priceTypes = useMemo(() => {
    if (!priceTypesData?.priceTypes) return [];
    return priceTypesData.priceTypes.filter(pt => pt.isActive);
  }, [priceTypesData]);

  // Initialize state from API data
  useEffect(() => {
    if (pricingData && priceTypes.length > 0) {
      const transformedDefaults = transformToConfig(
        pricingData.defaultPricing,
        priceTypes,
      );
      setDefaultConfigs(transformedDefaults);
      setHasChanges(false);
    }
  }, [pricingData, priceTypes]);

  // Handle default config changes
  const handleDefaultConfigChange = useCallback(
    (newConfigs: UpChargePriceTypeConfig[]) => {
      setDefaultConfigs(newConfigs);
      setHasChanges(true);
    },
    [],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!pricingData) return;

    try {
      // Save default prices for each office
      for (const office of offices) {
        const prices = transformToApiRequest(defaultConfigs, office.id);
        await updateDefaultPricesMutation.mutateAsync({
          upchargeId,
          data: {
            officeId: office.id,
            prices,
            version: pricingData.upcharge.version,
          },
        });
      }

      setHasChanges(false);
      onClose();
    } catch (err) {
      console.error('Failed to save upcharge pricing:', err);
    }
  }, [
    defaultConfigs,
    offices,
    pricingData,
    upchargeId,
    updateDefaultPricesMutation,
    onClose,
  ]);

  // Handle close with unsaved changes
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?',
      );
      if (!confirmed) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  // Loading state
  const isLoading = isLoadingPricing || isLoadingPriceTypes;
  const isSaving = updateDefaultPricesMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AttachMoneyIcon color="primary" />
          <Box>
            <Typography variant="h6">Default Pricing</Typography>
            <Typography variant="caption" color="text.secondary">
              {upchargeName}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {isLoading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: 8,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {pricingError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load pricing data. Please try again.
          </Alert>
        )}

        {updateDefaultPricesMutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to save pricing. Please try again.
          </Alert>
        )}

        {!isLoading && !pricingError && priceTypes.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure the default pricing for this upcharge. Click any cell to
              edit, or click a column header to set all offices at once.
            </Typography>
            <DefaultPricingGrid
              priceTypes={priceTypes}
              offices={offices}
              configs={defaultConfigs}
              onChange={handleDefaultConfigChange}
              samplePrices={sampleOption?.prices}
              disabled={isSaving}
            />
          </Box>
        )}

        {!isLoading && priceTypes.length === 0 && (
          <Alert severity="warning">
            No price types are configured. Please set up price types first.
          </Alert>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Box sx={{ flex: 1 }}>
          {hasChanges && (
            <Typography variant="caption" color="warning.main">
              You have unsaved changes
            </Typography>
          )}
        </Box>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={isSaving || !hasChanges}
          startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
