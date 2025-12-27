/**
 * Price Guide Pricing Page.
 * View and edit pricing for a specific Measure Sheet Item.
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
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
import { useState, useMemo, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { PricingGrid } from '../../components/price-guide/PricingGrid';
import { useMsiDetail, usePriceTypes } from '../../hooks/usePriceGuide';

import type { PricingData } from '../../components/price-guide/PricingGrid';

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

  // Local pricing state (for demo - actual implementation would use API)
  const [basePricing, setBasePricing] = useState<PricingData>({});
  const [optionPricing, setOptionPricing] = useState<
    Record<string, PricingData>
  >({});

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

  const handleBasePriceChange = useCallback(
    (officeId: string, priceTypeId: string, amount: number) => {
      setBasePricing(prev => ({
        ...prev,
        [officeId]: {
          ...prev[officeId],
          [priceTypeId]: amount,
        },
      }));
    },
    [],
  );

  const handleOptionPriceChange = useCallback(
    (
      optionId: string,
      officeId: string,
      priceTypeId: string,
      amount: number,
    ) => {
      setOptionPricing(prev => ({
        ...prev,
        [optionId]: {
          ...prev[optionId],
          [officeId]: {
            ...prev[optionId]?.[officeId],
            [priceTypeId]: amount,
          },
        },
      }));
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
          <AttachMoneyIcon sx={{ fontSize: 32, color: 'success.main' }} />
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
            <Tab label="Base Pricing" id="pricing-tab-0" />
            {msi.options.length > 0 && (
              <Tab label="Option Pricing" id="pricing-tab-1" />
            )}
            {msi.upcharges.length > 0 && (
              <Tab
                label="UpCharge Pricing"
                id={`pricing-tab-${msi.options.length > 0 ? 2 : 1}`}
              />
            )}
          </Tabs>
        </Box>

        <CardContent>
          {/* Base Pricing Tab */}
          <TabPanel value={activeTab} index={0}>
            <PricingGrid
              offices={offices}
              priceTypes={priceTypes}
              pricing={basePricing}
              onPriceChange={handleBasePriceChange}
              title="Base Item Pricing"
              subtitle="Set the base prices for this item across all offices. These prices apply when no specific option is selected."
            />
          </TabPanel>

          {/* Option Pricing Tab */}
          {msi.options.length > 0 && (
            <TabPanel value={activeTab} index={1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure pricing for each option. Option pricing overrides the
                base price when that option is selected.
              </Typography>

              {msi.options.map((option, index) => (
                <Box key={option.optionId} sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
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
                  <PricingGrid
                    offices={offices}
                    priceTypes={priceTypes}
                    pricing={optionPricing[option.optionId] ?? {}}
                    onPriceChange={(officeId, priceTypeId, amount) =>
                      handleOptionPriceChange(
                        option.optionId,
                        officeId,
                        priceTypeId,
                        amount,
                      )
                    }
                  />
                  {index < msi.options.length - 1 && <Divider sx={{ mt: 3 }} />}
                </Box>
              ))}
            </TabPanel>
          )}

          {/* UpCharge Pricing Tab */}
          {msi.upcharges.length > 0 && (
            <TabPanel value={activeTab} index={msi.options.length > 0 ? 2 : 1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure pricing for each upcharge. Upcharges can have fixed
                prices or percentage-based pricing.
              </Typography>

              {msi.upcharges.map((upcharge, index) => (
                <Box key={upcharge.upchargeId} sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
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
                  <PricingGrid
                    offices={offices}
                    priceTypes={priceTypes}
                    pricing={{}}
                    onPriceChange={() => {
                      // Upcharge pricing handler would go here
                    }}
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
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back to Price Guide
        </Button>
        <Button variant="contained" color="primary">
          Save Pricing
        </Button>
      </Box>
    </Box>
  );
}
