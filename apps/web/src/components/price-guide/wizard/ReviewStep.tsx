/**
 * Review Step Component.
 * Step 6 (Final) of the Create MSI Wizard.
 * Shows a summary of all selections before creation.
 */

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import { useOfficesList } from '../../../hooks/useOffices';
import { usePriceTypes } from '../../../hooks/usePriceGuide';
import { useWizard } from '../../../pages/price-guide/CreateWizard';

// ============================================================================
// Helper Components
// ============================================================================

type SectionProps = {
  title: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
};

function ReviewSection({
  title,
  children,
  isEmpty,
  emptyMessage,
}: SectionProps): React.ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {title}
        </Typography>
        {isEmpty ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage ?? 'None selected'}
          </Typography>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Input Type Labels
// ============================================================================

const INPUT_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  picker: 'Picker',
  date: 'Date',
  toggle: 'Toggle',
};

const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  each: 'Each',
  sqft: 'Square Feet',
  linear_ft: 'Linear Feet',
  united_inches: 'United Inches',
  pair: 'Pair',
};

// ============================================================================
// Main Component
// ============================================================================

export function ReviewStep(): React.ReactElement {
  const { state } = useWizard();

  // Queries for displaying names
  const { data: officesData, isLoading: isLoadingOffices } = useOfficesList();
  const { data: priceTypesData, isLoading: isLoadingPriceTypes } =
    usePriceTypes();

  // Map office IDs to names
  const officeNamesMap = useMemo(() => {
    if (!officesData?.offices) return new Map<string, string>();
    return new Map(officesData.offices.map(o => [o.id, o.name]));
  }, [officesData]);

  // Map price type IDs to names
  const priceTypeNamesMap = useMemo(() => {
    if (!priceTypesData?.priceTypes) return new Map<string, string>();
    return new Map(priceTypesData.priceTypes.map(pt => [pt.id, pt.name]));
  }, [priceTypesData]);

  // Count total prices set
  const pricingCount = useMemo(() => {
    let count = 0;
    for (const officeId of Object.keys(state.msiPricing)) {
      for (const priceTypeId of Object.keys(state.msiPricing[officeId] ?? {})) {
        const value = state.msiPricing[officeId]?.[priceTypeId];
        if (value && value > 0) {
          count++;
        }
      }
    }
    return count;
  }, [state.msiPricing]);

  // Validation
  const isValid = useMemo(() => {
    return (
      state.name.trim().length > 0 &&
      state.categoryId.length > 0 &&
      state.measurementType.length > 0 &&
      state.officeIds.length > 0
    );
  }, [state.name, state.categoryId, state.measurementType, state.officeIds]);

  const isLoading = isLoadingOffices || isLoadingPriceTypes;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Review & Create
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Review your selections below before creating the measure sheet item.
      </Typography>

      {isValid ? (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          All required fields are complete. You&apos;re ready to create this
          item.
        </Alert>
      ) : (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          Some required fields are missing. Please go back and complete them.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Column: Basic Info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ReviewSection title="Basic Information">
            <List dense disablePadding>
              <ListItem disableGutters>
                <ListItemText
                  primary="Item Name"
                  secondary={state.name || '—'}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                  }}
                  secondaryTypographyProps={{
                    variant: 'body1',
                    color: 'text.primary',
                  }}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Category"
                  secondary={state.categoryName || '—'}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                  }}
                  secondaryTypographyProps={{
                    variant: 'body1',
                    color: 'text.primary',
                  }}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Measurement Type"
                  secondary={
                    MEASUREMENT_TYPE_LABELS[state.measurementType] ??
                    state.measurementType
                  }
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                  }}
                  secondaryTypographyProps={{
                    variant: 'body1',
                    color: 'text.primary',
                  }}
                />
              </ListItem>
              {state.note && (
                <ListItem disableGutters>
                  <ListItemText
                    primary="Note"
                    secondary={state.note}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                    }}
                    secondaryTypographyProps={{
                      variant: 'body1',
                      color: 'text.primary',
                    }}
                  />
                </ListItem>
              )}
              <ListItem disableGutters>
                <ListItemText
                  primary="Default Quantity"
                  secondary={state.defaultQty}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                  }}
                  secondaryTypographyProps={{
                    variant: 'body1',
                    color: 'text.primary',
                  }}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Show Switch"
                  secondary={state.showSwitch ? 'Yes' : 'No'}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                  }}
                  secondaryTypographyProps={{
                    variant: 'body1',
                    color: 'text.primary',
                  }}
                />
              </ListItem>
            </List>
          </ReviewSection>

          {/* Offices */}
          <ReviewSection
            title={`Offices (${state.officeIds.length})`}
            isEmpty={state.officeIds.length === 0}
            emptyMessage="No offices selected (required)"
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {state.officeIds.map(officeId => (
                <Chip
                  key={officeId}
                  label={officeNamesMap.get(officeId) ?? officeId}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          </ReviewSection>

          {/* Tag Settings */}
          {(state.tagTitle || state.tagPickerOptions.length > 0) && (
            <ReviewSection title="Tag Settings">
              <List dense disablePadding>
                {state.tagTitle && (
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Tag Title"
                      secondary={state.tagTitle}
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: 'text.secondary',
                      }}
                      secondaryTypographyProps={{
                        variant: 'body1',
                        color: 'text.primary',
                      }}
                    />
                  </ListItem>
                )}
                <ListItem disableGutters>
                  <ListItemText
                    primary="Tag Required"
                    secondary={state.tagRequired ? 'Yes' : 'No'}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                    }}
                    secondaryTypographyProps={{
                      variant: 'body1',
                      color: 'text.primary',
                    }}
                  />
                </ListItem>
              </List>
            </ReviewSection>
          )}
        </Grid>

        {/* Right Column: Linked Items */}
        <Grid size={{ xs: 12, md: 6 }}>
          {/* Options */}
          <ReviewSection
            title={`Linked Options (${state.options.length})`}
            isEmpty={state.options.length === 0}
            emptyMessage="No options linked"
          >
            <List dense disablePadding>
              {state.options.map(option => (
                <ListItem key={option.id} disableGutters>
                  <ListItemText
                    primary={option.name}
                    secondary={option.brand}
                  />
                </ListItem>
              ))}
            </List>
          </ReviewSection>

          {/* UpCharges */}
          <ReviewSection
            title={`Linked UpCharges (${state.upcharges.length})`}
            isEmpty={state.upcharges.length === 0}
            emptyMessage="No upcharges linked"
          >
            <List dense disablePadding>
              {state.upcharges.map(upcharge => (
                <ListItem key={upcharge.id} disableGutters>
                  <ListItemText
                    primary={upcharge.name}
                    secondary={
                      upcharge.disabledOptionIds.length > 0
                        ? `Disabled for ${upcharge.disabledOptionIds.length} option(s)`
                        : undefined
                    }
                  />
                </ListItem>
              ))}
            </List>
          </ReviewSection>

          {/* Additional Details */}
          <ReviewSection
            title={`Additional Details (${state.additionalDetails.length})`}
            isEmpty={state.additionalDetails.length === 0}
            emptyMessage="No additional details linked"
          >
            <List dense disablePadding>
              {state.additionalDetails.map(detail => (
                <ListItem key={detail.id} disableGutters>
                  <ListItemText
                    primary={detail.title}
                    secondary={
                      INPUT_TYPE_LABELS[detail.inputType] ?? detail.inputType
                    }
                  />
                </ListItem>
              ))}
            </List>
          </ReviewSection>

          {/* Pricing Summary */}
          <ReviewSection
            title="Pricing"
            isEmpty={pricingCount === 0}
            emptyMessage="No prices set (can be configured after creation)"
          >
            <Typography variant="body2" color="text.secondary">
              {pricingCount} price{pricingCount !== 1 ? 's' : ''} configured
              across offices and price types.
            </Typography>
            <Divider sx={{ my: 1 }} />
            {Object.entries(state.msiPricing).map(([officeId, prices]) => {
              const officePrices = Object.entries(prices).filter(
                ([, value]) => value > 0,
              );
              if (officePrices.length === 0) return null;
              return (
                <Box key={officeId} sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={500}>
                    {officeNamesMap.get(officeId) ?? officeId}
                  </Typography>
                  <Box sx={{ pl: 1 }}>
                    {officePrices.map(([priceTypeId, value]) => (
                      <Typography key={priceTypeId} variant="body2">
                        {priceTypeNamesMap.get(priceTypeId) ?? priceTypeId}: $
                        {value.toFixed(2)}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </ReviewSection>
        </Grid>
      </Grid>
    </Box>
  );
}
