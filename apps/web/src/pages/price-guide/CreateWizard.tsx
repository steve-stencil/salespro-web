/**
 * Price Guide Create Wizard Page.
 * Multi-step wizard for creating a new Measure Sheet Item.
 *
 * Note: All MSIs require at least one option for pricing. See ADR-003.
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import { useReducer, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
import { useCreateMsi } from '../../hooks/usePriceGuide';

import type { WizardContextType } from '../../components/price-guide/wizard/WizardContext';
import type { CreateMsiRequest } from '@shared/types';

// ============================================================================
// Step Configuration
// ============================================================================

const STEPS = [
  { label: 'Basic Info', description: 'Name, category, and settings' },
  { label: 'Options', description: 'Link product options (required)' },
  { label: 'UpCharges', description: 'Link upcharge items' },
  { label: 'Additional Details', description: 'Add custom fields' },
  { label: 'Pricing', description: 'Set option prices' },
  { label: 'Review', description: 'Review and create' },
];

// ============================================================================
// Main Component
// ============================================================================

export function CreateWizard(): React.ReactElement {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);

  const createMutation = useCreateMsi();

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
      setImage: image => dispatch({ type: 'SET_IMAGE', payload: image }),
      removeImage: () => dispatch({ type: 'REMOVE_IMAGE' }),
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

  // At least one option is required. See ADR-003.
  const hasOptions = state.options.length > 0;

  const canProceed = useMemo(() => {
    switch (activeStep) {
      case 0:
        return isStep1Valid;
      case 1:
        return hasOptions; // At least one option is required
      case 2:
      case 3:
      case 4:
        return true; // Optional steps
      case 5:
        return isStep1Valid && hasOptions; // Review step - needs valid info + options
      default:
        return false;
    }
  }, [activeStep, isStep1Valid, hasOptions]);

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

  const handleCreate = useCallback(async () => {
    const request: CreateMsiRequest = {
      name: state.name,
      categoryId: state.categoryId,
      measurementType: state.measurementType,
      note: state.note || undefined,
      defaultQty: Number(state.defaultQty),
      showSwitch: state.showSwitch,
      tagTitle: state.tagTitle || undefined,
      tagRequired: state.tagRequired,
      tagPickerOptions:
        state.tagPickerOptions.length > 0 ? state.tagPickerOptions : undefined,
      officeIds: state.officeIds,
      optionIds: state.options.map(o => o.id),
      upchargeIds: state.upcharges.map(u => u.id),
      additionalDetailFieldIds: state.additionalDetails.map(d => d.id),
    };

    try {
      await createMutation.mutateAsync(request);
      void navigate('/price-guide');
    } catch (error) {
      console.error('Failed to create MSI:', error);
    }
  }, [state, createMutation, navigate]);

  const handleCancel = useCallback(() => {
    void navigate('/price-guide');
  }, [navigate]);

  return (
    <WizardContext.Provider value={contextValue}>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h2" component="h1" gutterBottom>
            Create Measure Sheet Item
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Follow the steps below to create a new item for your price guide.
          </Typography>
        </Box>

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
              <Button
                variant="contained"
                color="success"
                startIcon={
                  createMutation.isPending ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <CheckIcon />
                  )
                }
                onClick={() => void handleCreate()}
                disabled={!canProceed || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Item'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </WizardContext.Provider>
  );
}
