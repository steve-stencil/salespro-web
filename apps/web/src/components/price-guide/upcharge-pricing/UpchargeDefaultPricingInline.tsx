/**
 * Inline UpCharge Default Pricing Component.
 * Shows upcharges as expandable cards with inline pricing grid (matches override UX).
 */

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
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

type UpchargeInfo = {
  id: string;
  name: string;
  note?: string | null;
  linkedMsiCount?: number;
};

type UpchargeDefaultPricingCardProps = {
  upcharge: UpchargeInfo;
  offices: Office[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

// ============================================================================
// Single Upcharge Pricing Card
// ============================================================================

function UpchargeDefaultPricingCard({
  upcharge,
  offices,
  onEdit,
  onDelete,
}: UpchargeDefaultPricingCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [defaultConfigs, setDefaultConfigs] = useState<
    UpChargePriceTypeConfig[]
  >([]);

  // Queries
  const {
    data: pricingData,
    isLoading: isLoadingPricing,
    error: pricingError,
  } = useUpchargePricing(upcharge.id, { enabled: expanded });

  const { data: priceTypesData, isLoading: isLoadingPriceTypes } =
    usePriceTypes();

  // Mutations
  const updateDefaultPricesMutation = useUpdateUpchargeDefaultPrices();

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

  // Handle toggle
  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // Handle config changes
  const handleConfigChange = useCallback(
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
          upchargeId: upcharge.id,
          data: {
            officeId: office.id,
            prices,
            version: pricingData.upcharge.version,
          },
        });
      }

      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save upcharge pricing:', err);
    }
  }, [
    defaultConfigs,
    offices,
    pricingData,
    upcharge.id,
    updateDefaultPricesMutation,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (pricingData && priceTypes.length > 0) {
      const transformedDefaults = transformToConfig(
        pricingData.defaultPricing,
        priceTypes,
      );
      setDefaultConfigs(transformedDefaults);
      setHasChanges(false);
    }
  }, [pricingData, priceTypes]);

  const isLoading = isLoadingPricing || isLoadingPriceTypes;
  const isSaving = updateDefaultPricesMutation.isPending;

  // Get pricing summary
  const pricingSummary = useMemo(() => {
    if (!defaultConfigs.length) return '';
    const modes = defaultConfigs.map(c => c.mode);
    const allSame = modes.every(m => m === modes[0]);
    if (allSame) {
      const mode = modes[0];
      if (mode === 'fixed') return 'Fixed pricing';
      if (mode === 'percentage') return 'Percentage-based';
    }
    return 'Mixed mode';
  }, [defaultConfigs]);

  return (
    <Accordion
      expanded={expanded}
      onChange={handleToggle}
      sx={{
        '&:before': { display: 'none' },
        boxShadow: 'none',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        '&:not(:last-child)': { mb: 1 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          '& .MuiAccordionSummary-content': {
            alignItems: 'center',
            justifyContent: 'space-between',
            mr: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1" fontWeight={600}>
              {upcharge.name}
              {upcharge.note && (
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  — {upcharge.note}
                </Typography>
              )}
            </Typography>
            {expanded && pricingSummary && (
              <Typography variant="caption" color="text.secondary">
                {pricingSummary}
              </Typography>
            )}
          </Box>

          {hasChanges && (
            <Chip
              label="Unsaved"
              size="small"
              color="warning"
              variant="outlined"
            />
          )}

          {upcharge.linkedMsiCount !== undefined &&
            upcharge.linkedMsiCount > 0 && (
              <Chip
                label={`${upcharge.linkedMsiCount} MSI${upcharge.linkedMsiCount > 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
              />
            )}
        </Box>

        {/* Actions (rendered outside the button context) */}
        <Stack
          direction="row"
          spacing={0.5}
          component="span"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <Tooltip title="Edit">
            <span>
              <IconButton size="small" onClick={() => onEdit?.(upcharge.id)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton
                size="small"
                onClick={() => onDelete?.(upcharge.id)}
                disabled={(upcharge.linkedMsiCount ?? 0) > 0}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {pricingError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load pricing data.
          </Alert>
        )}

        {updateDefaultPricesMutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to save pricing.
          </Alert>
        )}

        {!isLoading && !pricingError && priceTypes.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click any cell to edit, or click a column header to set all
              offices at once.
            </Typography>

            <DefaultPricingGrid
              priceTypes={priceTypes}
              offices={offices}
              configs={defaultConfigs}
              onChange={handleConfigChange}
              disabled={isSaving}
            />

            {hasChanges && (
              <Box
                sx={{
                  mt: 2,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                }}
              >
                <Button size="small" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

// ============================================================================
// Main Component
// ============================================================================

type UpchargeDefaultPricingInlineProps = {
  upcharges: UpchargeInfo[];
  offices: Office[];
  isLoading?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function UpchargeDefaultPricingInline({
  upcharges,
  offices,
  isLoading = false,
  onEdit,
  onDelete,
}: UpchargeDefaultPricingInlineProps): React.ReactElement {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (upcharges.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">No upcharges found.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {upcharges.length} upcharge{upcharges.length !== 1 ? 's' : ''} • Expand
        to configure default pricing
      </Typography>

      <Stack spacing={1}>
        {upcharges.map(upcharge => (
          <UpchargeDefaultPricingCard
            key={upcharge.id}
            upcharge={upcharge}
            offices={offices}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </Stack>
    </Box>
  );
}
