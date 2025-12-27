/**
 * Price Guide Create Wizard Page.
 * Multi-step wizard for creating a new Measure Sheet Item.
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
import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { AdditionalDetailsStep } from '../../components/price-guide/wizard/AdditionalDetailsStep';
import { BasicInfoStep } from '../../components/price-guide/wizard/BasicInfoStep';
import { LinkOptionsStep } from '../../components/price-guide/wizard/LinkOptionsStep';
import { LinkUpChargesStep } from '../../components/price-guide/wizard/LinkUpChargesStep';
import { useCreateMsi } from '../../hooks/usePriceGuide';

import type { CreateMsiRequest } from '@shared/types';

// ============================================================================
// Wizard State Types
// ============================================================================

type LinkedOption = {
  id: string;
  name: string;
  brand: string | null;
};

type LinkedUpCharge = {
  id: string;
  name: string;
  disabledOptionIds: string[];
};

type LinkedAdditionalDetail = {
  id: string;
  title: string;
  inputType: string;
};

export type WizardState = {
  // Step 1: Basic Info
  name: string;
  categoryId: string;
  categoryName: string;
  measurementType: string;
  note: string;
  defaultQty: number;
  showSwitch: boolean;
  tagTitle: string;
  tagRequired: boolean;
  tagPickerOptions: string[];
  officeIds: string[];

  // Step 2: Options
  options: LinkedOption[];

  // Step 3: UpCharges
  upcharges: LinkedUpCharge[];

  // Step 4: Additional Details
  additionalDetails: LinkedAdditionalDetail[];
};

type WizardAction =
  | { type: 'SET_BASIC_INFO'; payload: Partial<WizardState> }
  | {
      type: 'SET_CATEGORY';
      payload: { categoryId: string; categoryName: string };
    }
  | { type: 'ADD_OPTION'; payload: LinkedOption }
  | { type: 'REMOVE_OPTION'; payload: string }
  | { type: 'ADD_UPCHARGE'; payload: LinkedUpCharge }
  | { type: 'REMOVE_UPCHARGE'; payload: string }
  | {
      type: 'UPDATE_UPCHARGE_DISABLED_OPTIONS';
      payload: { upchargeId: string; disabledOptionIds: string[] };
    }
  | { type: 'ADD_ADDITIONAL_DETAIL'; payload: LinkedAdditionalDetail }
  | { type: 'REMOVE_ADDITIONAL_DETAIL'; payload: string }
  | { type: 'RESET' };

const initialState: WizardState = {
  name: '',
  categoryId: '',
  categoryName: '',
  measurementType: 'each',
  note: '',
  defaultQty: 1,
  showSwitch: false,
  tagTitle: '',
  tagRequired: false,
  tagPickerOptions: [],
  officeIds: [],
  options: [],
  upcharges: [],
  additionalDetails: [],
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_BASIC_INFO':
      return { ...state, ...action.payload };
    case 'SET_CATEGORY':
      return {
        ...state,
        categoryId: action.payload.categoryId,
        categoryName: action.payload.categoryName,
      };
    case 'ADD_OPTION':
      if (state.options.some(o => o.id === action.payload.id)) {
        return state;
      }
      return { ...state, options: [...state.options, action.payload] };
    case 'REMOVE_OPTION':
      return {
        ...state,
        options: state.options.filter(o => o.id !== action.payload),
        // Also remove from disabled options in upcharges
        upcharges: state.upcharges.map(uc => ({
          ...uc,
          disabledOptionIds: uc.disabledOptionIds.filter(
            id => id !== action.payload,
          ),
        })),
      };
    case 'ADD_UPCHARGE':
      if (state.upcharges.some(u => u.id === action.payload.id)) {
        return state;
      }
      return { ...state, upcharges: [...state.upcharges, action.payload] };
    case 'REMOVE_UPCHARGE':
      return {
        ...state,
        upcharges: state.upcharges.filter(u => u.id !== action.payload),
      };
    case 'UPDATE_UPCHARGE_DISABLED_OPTIONS':
      return {
        ...state,
        upcharges: state.upcharges.map(uc =>
          uc.id === action.payload.upchargeId
            ? { ...uc, disabledOptionIds: action.payload.disabledOptionIds }
            : uc,
        ),
      };
    case 'ADD_ADDITIONAL_DETAIL':
      if (state.additionalDetails.some(d => d.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        additionalDetails: [...state.additionalDetails, action.payload],
      };
    case 'REMOVE_ADDITIONAL_DETAIL':
      return {
        ...state,
        additionalDetails: state.additionalDetails.filter(
          d => d.id !== action.payload,
        ),
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ============================================================================
// Wizard Context
// ============================================================================

type WizardContextType = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  setBasicInfo: (info: Partial<WizardState>) => void;
  setCategory: (categoryId: string, categoryName: string) => void;
  addOption: (option: LinkedOption) => void;
  removeOption: (optionId: string) => void;
  addUpcharge: (upcharge: LinkedUpCharge) => void;
  removeUpcharge: (upchargeId: string) => void;
  updateUpchargeDisabledOptions: (
    upchargeId: string,
    disabledOptionIds: string[],
  ) => void;
  addAdditionalDetail: (detail: LinkedAdditionalDetail) => void;
  removeAdditionalDetail: (detailId: string) => void;
};

const WizardContext = createContext<WizardContextType | null>(null);

export function useWizard(): WizardContextType {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within CreateWizard');
  }
  return context;
}

// ============================================================================
// Step Configuration
// ============================================================================

const STEPS = [
  { label: 'Basic Info', description: 'Name, category, and settings' },
  { label: 'Options', description: 'Link product options' },
  { label: 'UpCharges', description: 'Link upcharge items' },
  { label: 'Additional Details', description: 'Add custom fields' },
];

// ============================================================================
// Main Component
// ============================================================================

export function CreateWizard(): React.ReactElement {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [state, dispatch] = useReducer(wizardReducer, initialState);

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
        return true; // Optional steps
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

  const handleCreate = useCallback(async () => {
    const request: CreateMsiRequest = {
      name: state.name,
      categoryId: state.categoryId,
      measurementType: state.measurementType,
      note: state.note || undefined,
      defaultQty: state.defaultQty,
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
