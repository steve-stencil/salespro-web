/**
 * Price Guide Edit Wizard Page.
 * Multi-step wizard for editing an existing Measure Sheet Item.
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import { useReducer, useCallback, useMemo, useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { AdditionalDetailsStep } from '../../components/price-guide/wizard/AdditionalDetailsStep';
import { BasicInfoStep } from '../../components/price-guide/wizard/BasicInfoStep';
import { LinkOptionsStep } from '../../components/price-guide/wizard/LinkOptionsStep';
import { LinkUpChargesStep } from '../../components/price-guide/wizard/LinkUpChargesStep';
import { PricingStep } from '../../components/price-guide/wizard/PricingStep';
import { ReviewStep } from '../../components/price-guide/wizard/ReviewStep';
import {
  WizardContext,
  wizardReducer,
  initialWizardState,
} from '../../components/price-guide/wizard/WizardContext';
import {
  useMsiDetail,
  useUpdateMsi,
  useSyncOffices,
  useLinkOptions,
  useUnlinkOption,
  useLinkUpcharges,
  useUnlinkUpcharge,
  useLinkAdditionalDetails,
  useUnlinkAdditionalDetail,
} from '../../hooks/usePriceGuide';

import type { WizardContextType } from '../../components/price-guide/wizard/WizardContext';
import type { UpdateMsiRequest } from '@shared/types';

// ============================================================================
// Step Configuration
// ============================================================================

const STEPS = [
  { label: 'Basic Info', description: 'Name, category, and settings' },
  { label: 'Options', description: 'Link product options' },
  { label: 'UpCharges', description: 'Link upcharge items' },
  { label: 'Additional Details', description: 'Add custom fields' },
  { label: 'Pricing', description: 'Set base prices' },
  { label: 'Review', description: 'Review and save' },
];

// ============================================================================
// Main Component
// ============================================================================

export function EditWizard(): React.ReactElement {
  const { msiId } = useParams<{ msiId: string }>();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);

  // Queries and mutations
  const {
    data: msiData,
    isLoading: isLoadingMsi,
    error: loadError,
  } = useMsiDetail(msiId ?? '');
  const updateMutation = useUpdateMsi();
  const syncOfficesMutation = useSyncOffices();
  const linkOptionsMutation = useLinkOptions();
  const unlinkOptionMutation = useUnlinkOption();
  const linkUpchargesMutation = useLinkUpcharges();
  const unlinkUpchargeMutation = useUnlinkUpcharge();
  const linkAdditionalDetailsMutation = useLinkAdditionalDetails();
  const unlinkAdditionalDetailMutation = useUnlinkAdditionalDetail();

  // Load MSI data into state
  useEffect(() => {
    if (msiData?.item && !state.isLoaded) {
      const msi = msiData.item;
      dispatch({
        type: 'LOAD_MSI',
        payload: {
          name: msi.name,
          categoryId: msi.category.id,
          categoryName: msi.category.name,
          measurementType: msi.measurementType,
          note: msi.note ?? '',
          defaultQty: Number(msi.defaultQty),
          showSwitch: msi.showSwitch,
          tagTitle: msi.tagTitle ?? '',
          tagRequired: msi.tagRequired,
          tagPickerOptions: msi.tagPickerOptions
            ? (msi.tagPickerOptions as string[])
            : [],
          officeIds: msi.offices.map(o => o.id),
          options: msi.options.map(o => ({
            id: o.optionId,
            name: o.name,
            brand: o.brand,
          })),
          upcharges: msi.upcharges.map(u => ({
            id: u.upchargeId,
            name: u.name,
            disabledOptionIds: [], // Would need to load from API
          })),
          additionalDetails: msi.additionalDetails.map(d => ({
            id: d.fieldId,
            title: d.title,
            inputType: d.inputType,
          })),
          msiPricing: {},
          version: msi.version,
          isLoaded: true,
        },
      });
    }
  }, [msiData, state.isLoaded]);

  // Context actions
  const contextValue = useMemo<WizardContextType>(
    () => ({
      state,
      dispatch,
      setBasicInfo: info => dispatch({ type: 'SET_BASIC_INFO', payload: info }),
      setCategory: (categoryId, categoryName) =>
        dispatch({
          type: 'SET_CATEGORY',
          payload: { categoryId, categoryName },
        }),
      addOption: option => dispatch({ type: 'ADD_OPTION', payload: option }),
      removeOption: optionId =>
        dispatch({ type: 'REMOVE_OPTION', payload: optionId }),
      addUpcharge: upcharge =>
        dispatch({ type: 'ADD_UPCHARGE', payload: upcharge }),
      removeUpcharge: upchargeId =>
        dispatch({ type: 'REMOVE_UPCHARGE', payload: upchargeId }),
      updateUpchargeDisabledOptions: (upchargeId, disabledOptionIds) =>
        dispatch({
          type: 'UPDATE_UPCHARGE_DISABLED_OPTIONS',
          payload: { upchargeId, disabledOptionIds },
        }),
      addAdditionalDetail: detail =>
        dispatch({ type: 'ADD_ADDITIONAL_DETAIL', payload: detail }),
      removeAdditionalDetail: detailId =>
        dispatch({ type: 'REMOVE_ADDITIONAL_DETAIL', payload: detailId }),
      setMsiPrice: (officeId, priceTypeId, amount) =>
        dispatch({
          type: 'SET_MSI_PRICE',
          payload: { officeId, priceTypeId, amount },
        }),
    }),
    [state],
  );

  // Validation
  const isStep1Valid = useMemo(() => {
    return (
      state.name.trim().length > 0 &&
      state.categoryId.length > 0 &&
      state.measurementType.length > 0 &&
      state.officeIds.length > 0
    );
  }, [state.name, state.categoryId, state.measurementType, state.officeIds]);

  const canProceed = useMemo(() => {
    switch (activeStep) {
      case 0:
        return isStep1Valid;
      case 1:
      case 2:
      case 3:
      case 4:
        return true;
      case 5:
        return isStep1Valid;
      default:
        return false;
    }
  }, [activeStep, isStep1Valid]);

  // Handlers
  const handleNext = useCallback(() => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  }, [activeStep]);

  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  }, [activeStep]);

  const handleSave = useCallback(async () => {
    if (!msiId || !msiData) return;

    // Version for optimistic locking (state.version if available, otherwise from loaded data)
    let version = state.version ?? msiData.item.version;

    try {
      // Step 1: Update basic MSI fields
      const request: UpdateMsiRequest = {
        name: state.name,
        categoryId: state.categoryId,
        measurementType: state.measurementType,
        note: state.note || null,
        defaultQty: Number(state.defaultQty),
        showSwitch: state.showSwitch,
        tagTitle: state.tagTitle || null,
        tagRequired: state.tagRequired,
        tagPickerOptions:
          state.tagPickerOptions.length > 0 ? state.tagPickerOptions : null,
        version,
      };

      const updateResult = await updateMutation.mutateAsync({
        msiId,
        data: request,
      });
      version = updateResult.item.version;

      // Step 2: Sync offices if changed
      const originalOfficeIds = new Set(msiData.item.offices.map(o => o.id));
      const newOfficeIds = new Set(state.officeIds);
      const officesChanged =
        originalOfficeIds.size !== newOfficeIds.size ||
        [...originalOfficeIds].some(id => !newOfficeIds.has(id));

      if (officesChanged) {
        const syncResult = await syncOfficesMutation.mutateAsync({
          msiId,
          officeIds: state.officeIds,
          version,
        });
        version = syncResult.item.version;
      }

      // Step 3: Sync options (unlink removed, link new)
      const originalOptionIds = new Set(
        msiData.item.options.map(o => o.optionId),
      );
      const newOptionIds = new Set(state.options.map(o => o.id));

      // Unlink removed options
      const optionsToUnlink = [...originalOptionIds].filter(
        id => !newOptionIds.has(id),
      );
      for (const optionId of optionsToUnlink) {
        await unlinkOptionMutation.mutateAsync({ msiId, optionId });
      }

      // Link new options
      const optionsToLink = [...newOptionIds].filter(
        id => !originalOptionIds.has(id),
      );
      if (optionsToLink.length > 0) {
        await linkOptionsMutation.mutateAsync({
          msiId,
          optionIds: optionsToLink,
        });
      }

      // Step 4: Sync upcharges (unlink removed, link new)
      const originalUpchargeIds = new Set(
        msiData.item.upcharges.map(u => u.upchargeId),
      );
      const newUpchargeIds = new Set(state.upcharges.map(u => u.id));

      // Unlink removed upcharges
      const upchargesToUnlink = [...originalUpchargeIds].filter(
        id => !newUpchargeIds.has(id),
      );
      for (const upchargeId of upchargesToUnlink) {
        await unlinkUpchargeMutation.mutateAsync({ msiId, upchargeId });
      }

      // Link new upcharges
      const upchargesToLink = [...newUpchargeIds].filter(
        id => !originalUpchargeIds.has(id),
      );
      if (upchargesToLink.length > 0) {
        await linkUpchargesMutation.mutateAsync({
          msiId,
          upchargeIds: upchargesToLink,
        });
      }

      // Step 5: Sync additional details (unlink removed, link new)
      const originalDetailIds = new Set(
        msiData.item.additionalDetails.map(d => d.fieldId),
      );
      const newDetailIds = new Set(state.additionalDetails.map(d => d.id));

      // Unlink removed additional details
      const detailsToUnlink = [...originalDetailIds].filter(
        id => !newDetailIds.has(id),
      );
      for (const fieldId of detailsToUnlink) {
        await unlinkAdditionalDetailMutation.mutateAsync({ msiId, fieldId });
      }

      // Link new additional details
      const detailsToLink = [...newDetailIds].filter(
        id => !originalDetailIds.has(id),
      );
      if (detailsToLink.length > 0) {
        await linkAdditionalDetailsMutation.mutateAsync({
          msiId,
          fieldIds: detailsToLink,
        });
      }

      void navigate(`/price-guide/${msiId}`);
    } catch (error) {
      console.error('Failed to update MSI:', error);
    }
  }, [
    msiId,
    state,
    msiData,
    updateMutation,
    syncOfficesMutation,
    linkOptionsMutation,
    unlinkOptionMutation,
    linkUpchargesMutation,
    unlinkUpchargeMutation,
    linkAdditionalDetailsMutation,
    unlinkAdditionalDetailMutation,
    navigate,
  ]);

  const handleCancel = useCallback(() => {
    void navigate(`/price-guide/${msiId}`);
  }, [navigate, msiId]);

  // Loading state
  if (isLoadingMsi) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (loadError || !msiData) {
    return (
      <Box>
        <Typography color="error" gutterBottom>
          Failed to load item. It may have been deleted or you may not have
          permission.
        </Typography>
        <Button component={RouterLink} to="/price-guide" variant="outlined">
          Back to Price Guide
        </Button>
      </Box>
    );
  }

  return (
    <WizardContext.Provider value={contextValue}>
      <Box>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component={RouterLink}
            to="/price-guide"
            underline="hover"
            color="inherit"
          >
            Price Guide
          </Link>
          <Link
            component={RouterLink}
            to={`/price-guide/${msiId}`}
            underline="hover"
            color="inherit"
          >
            {msiData.item.name}
          </Link>
          <Typography color="text.primary">Edit</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h2" component="h1" gutterBottom>
            Edit: {msiData.item.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Modify the settings for this measure sheet item.
          </Typography>
        </Box>

        {/* Version warning */}
        {msiData.item.lastModifiedBy && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Last modified by {msiData.item.lastModifiedBy.name}
            {msiData.item.lastModifiedAt && (
              <> on {new Date(msiData.item.lastModifiedAt).toLocaleString()}</>
            )}
          </Alert>
        )}

        {/* Stepper */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stepper activeStep={activeStep} alternativeLabel>
              {STEPS.map((step, index) => (
                <Step key={step.label} completed={index < activeStep}>
                  <StepLabel
                    optional={
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    }
                  >
                    {step.label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ py: 4 }}>
            {activeStep === 0 && <BasicInfoStep />}
            {activeStep === 1 && <LinkOptionsStep />}
            {activeStep === 2 && <LinkUpChargesStep />}
            {activeStep === 3 && <AdditionalDetailsStep />}
            {activeStep === 4 && <PricingStep />}
            {activeStep === 5 && <ReviewStep />}
          </CardContent>
        </Card>

        {/* Save error */}
        {(updateMutation.isError || syncOfficesMutation.isError) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {(() => {
              const error = (updateMutation.error ??
                syncOfficesMutation.error) as
                | { response?: { data?: { error?: string } } }
                | undefined;
              const errorCode = error?.response?.data?.error;
              if (errorCode === 'CONCURRENT_MODIFICATION') {
                return 'This item was modified by another user while you were editing. Please refresh the page and try again.';
              }
              return 'Failed to save changes. Please try again.';
            })()}
          </Alert>
        )}

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="text" onClick={handleCancel}>
            Cancel
          </Button>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              disabled={activeStep === 0}
            >
              Back
            </Button>

            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={handleNext}
                disabled={!canProceed}
              >
                Next
              </Button>
            ) : (
              (() => {
                const isSaving =
                  updateMutation.isPending ||
                  syncOfficesMutation.isPending ||
                  linkOptionsMutation.isPending ||
                  unlinkOptionMutation.isPending ||
                  linkUpchargesMutation.isPending ||
                  unlinkUpchargeMutation.isPending ||
                  linkAdditionalDetailsMutation.isPending ||
                  unlinkAdditionalDetailMutation.isPending;
                return (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={
                      isSaving ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <SaveIcon />
                      )
                    }
                    onClick={() => void handleSave()}
                    disabled={!canProceed || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                );
              })()
            )}
          </Box>
        </Box>
      </Box>
    </WizardContext.Provider>
  );
}
