/**
 * Price Guide Pricing Page.
 * View and edit pricing for a specific Measure Sheet Item.
 *
 * Note: All MSIs require at least one option. Pricing flows through OptionPrice
 * entities, not base MSI pricing. See ADR-003.
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { PricingGrid } from '../../components/price-guide/PricingGrid';
import { UpchargePricingByOption } from '../../components/price-guide/upcharge-pricing/UpchargePricingByOption';
import {
  useMsiDetail,
  usePriceTypes,
  useOptionPricing,
  useUpdateOptionPricing,
  useUpdateOptionPricingBulk,
} from '../../hooks/usePriceGuide';

import type { PricingData } from '../../components/price-guide/PricingGrid';
import type { PriceType } from '@shared/types';

// ============================================================================
// Tab Panel
// ============================================================================

type TabPanelProps = {
  children?: React.ReactNode;
  index: number;
  value: number;
};

function TabPanel({
  children,
  value,
  index,
}: TabPanelProps): React.ReactElement {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`pricing-tabpanel-${index}`}
      aria-labelledby={`pricing-tab-${index}`}
      sx={{ py: 3 }}
    >
      {value === index && children}
    </Box>
  );
}

// ============================================================================
// Option Pricing Card
// ============================================================================

type OptionPricingCardProps = {
  option: {
    optionId: string;
    name: string;
    brand?: string | null;
  };
  offices: Array<{ id: string; name: string }>;
  priceTypes: PriceType[];
  isLast: boolean;
};

function OptionPricingCard({
  option,
  offices,
  priceTypes,
  isLast,
}: OptionPricingCardProps): React.ReactElement {
  const [localPricing, setLocalPricing] = useState<PricingData>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Query for existing prices
  const { data: pricingData, isLoading: isLoadingPricing } = useOptionPricing(
    option.optionId,
  );

  // Mutations
  const updatePricingMutation = useUpdateOptionPricing();
  const updatePricingBulkMutation = useUpdateOptionPricingBulk();

  // Initialize local state from API data
  useEffect(() => {
    if (pricingData?.byOffice) {
      const initial: PricingData = {};
      for (const [officeId, officeData] of Object.entries(
        pricingData.byOffice,
      )) {
        initial[officeId] = officeData.prices;
      }
      setLocalPricing(initial);
      setHasChanges(false);
    }
  }, [pricingData]);

  // Handle individual price change
  const handlePriceChange = useCallback(
    (officeId: string, priceTypeId: string, amount: number) => {
      setLocalPricing(prev => ({
        ...prev,
        [officeId]: {
          ...prev[officeId],
          [priceTypeId]: amount,
        },
      }));
      setHasChanges(true);
    },
    [],
  );

  // Handle bulk price change (only for offices where this price type is enabled)
  const handleBulkPriceChange = useCallback(
    (priceTypeId: string, amount: number) => {
      // Find the price type to check which offices have it enabled
      const priceType = priceTypes.find(pt => pt.id === priceTypeId);
      const enabledOfficeIds = priceType?.enabledOfficeIds ?? [];

      setLocalPricing(prev => {
        const updated = { ...prev };
        for (const office of offices) {
          // Only update if this price type is enabled for this office
          if (
            enabledOfficeIds.length === 0 ||
            enabledOfficeIds.includes(office.id)
          ) {
            updated[office.id] = {
              ...updated[office.id],
              [priceTypeId]: amount,
            };
          }
        }
        return updated;
      });
      setHasChanges(true);
    },
    [offices, priceTypes],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!pricingData) return;

    try {
      // Save prices for each office
      for (const office of offices) {
        const officePrices = localPricing[office.id];
        if (!officePrices) continue;

        const prices = Object.entries(officePrices).map(
          ([priceTypeId, amount]) => ({
            priceTypeId,
            amount,
          }),
        );

        if (prices.length > 0) {
          await updatePricingMutation.mutateAsync({
            optionId: option.optionId,
            data: {
              officeId: office.id,
              prices,
              version: pricingData.option.version,
            },
          });
        }
      }

      setHasChanges(false);
    } catch {
      // Error handling is done by React Query
    }
  }, [
    localPricing,
    offices,
    option.optionId,
    pricingData,
    updatePricingMutation,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (pricingData?.byOffice) {
      const initial: PricingData = {};
      for (const [officeId, officeData] of Object.entries(
        pricingData.byOffice,
      )) {
        initial[officeId] = officeData.prices;
      }
      setLocalPricing(initial);
      setHasChanges(false);
    }
  }, [pricingData]);

  const isSaving =
    updatePricingMutation.isPending || updatePricingBulkMutation.isPending;

  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          {option.name}
          {option.brand && (
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              ({option.brand})
            </Typography>
          )}
        </Typography>
        {hasChanges && (
          <Box sx={{ display: 'flex', gap: 1 }}>
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

      {isLoadingPricing ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click any cell to edit, or click a column header to set all offices
            at once.
          </Typography>
          <PricingGrid
            offices={offices}
            priceTypes={priceTypes}
            pricing={localPricing}
            onPriceChange={handlePriceChange}
            onBulkPriceChange={handleBulkPriceChange}
          />
        </>
      )}

      {updatePricingMutation.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to save pricing. Please try again.
        </Alert>
      )}

      {!isLast && <Divider sx={{ mt: 3 }} />}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PricingPage(): React.ReactElement {
  const { msiId } = useParams<{ msiId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  // Queries
  const {
    data: msiData,
    isLoading: isLoadingMsi,
    error: msiError,
  } = useMsiDetail(msiId ?? '');
  const { data: priceTypesData, isLoading: isLoadingPriceTypes } =
    usePriceTypes();

  // Get offices from MSI detail
  const offices = useMemo(() => {
    if (!msiData?.item.offices) return [];
    return msiData.item.offices;
  }, [msiData]);

  // Get price types
  const priceTypes = useMemo(() => {
    if (!priceTypesData?.priceTypes) return [];
    return priceTypesData.priceTypes.filter(pt => pt.isActive);
  }, [priceTypesData]);

  // Handlers
  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
    },
    [],
  );

  const handleBack = useCallback(() => {
    void navigate('/price-guide');
  }, [navigate]);

  // Loading state
  const isLoading = isLoadingMsi || isLoadingPriceTypes;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (msiError || !msiData) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back to Price Guide
        </Button>
        <Typography color="error">
          Failed to load MSI details. Please try again.
        </Typography>
      </Box>
    );
  }

  const msi = msiData.item;

  // MSIs require at least one option (see ADR-003)
  if (msi.options.length === 0) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back to Price Guide
        </Button>
        <Alert severity="warning">
          This item has no options. All items require at least one option for
          pricing. Please add an option first.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link
            component={RouterLink}
            to="/price-guide"
            underline="hover"
            color="inherit"
          >
            Price Guide
          </Link>
          <Typography color="text.primary">Pricing</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={msi.thumbnailImage?.thumbnailUrl ?? undefined}
            alt={msi.name}
            variant="rounded"
            sx={{
              width: 48,
              height: 48,
              bgcolor: msi.thumbnailImage?.thumbnailUrl
                ? 'transparent'
                : 'action.hover',
            }}
          >
            {!msi.thumbnailImage?.thumbnailUrl && <ImageIcon color="action" />}
          </Avatar>
          <Box>
            <Typography variant="h2" component="h1">
              {msi.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {msi.category.fullPath} • {msi.measurementType}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Offices
              </Typography>
              <Typography variant="body1">{msi.offices.length}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Options
              </Typography>
              <Typography variant="body1">{msi.options.length}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">
                UpCharges
              </Typography>
              <Typography variant="body1">{msi.upcharges.length}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Option Pricing" id="pricing-tab-0" />
            {msi.upcharges.length > 0 && (
              <Tab label="UpCharge Pricing" id="pricing-tab-1" />
            )}
          </Tabs>
        </Box>

        <CardContent>
          {/* Option Pricing Tab */}
          <TabPanel value={activeTab} index={0}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure pricing for each option. These prices are used when the
              option is selected on an estimate.
            </Typography>

            {msi.options.map((option, index) => (
              <OptionPricingCard
                key={option.optionId}
                option={option}
                offices={offices}
                priceTypes={priceTypes}
                isLast={index === msi.options.length - 1}
              />
            ))}
          </TabPanel>

          {/* UpCharge Pricing Tab */}
          {msi.upcharges.length > 0 && (
            <TabPanel value={activeTab} index={1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure upcharge pricing overrides per option. Default pricing
                is set in the Library. Expand an option to customize its pricing
                for a specific upcharge.
              </Typography>

              {msi.upcharges.map((upcharge, index) => (
                <Box key={upcharge.upchargeId} sx={{ mb: 4 }}>
                  <UpchargePricingByOption
                    upchargeId={upcharge.upchargeId}
                    upchargeName={upcharge.name}
                    upchargeNote={upcharge.note}
                    options={msi.options.map(o => ({
                      id: o.optionId,
                      name: o.name,
                      brand: o.brand,
                    }))}
                    offices={offices}
                  />
                  {index < msi.upcharges.length - 1 && (
                    <Divider sx={{ mt: 3 }} />
                  )}
                </Box>
              ))}
            </TabPanel>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-start' }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back to Price Guide
        </Button>
      </Box>
    </Box>
  );
}
