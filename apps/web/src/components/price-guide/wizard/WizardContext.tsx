/**
 * Shared Wizard Context.
 * Used by CreateWizard and MsiEditPage.
 */

import { createContext, useContext } from 'react';

// ============================================================================
// Shared Types
// ============================================================================

export type LinkedOption = {
  id: string;
  name: string;
  brand: string | null;
};

export type LinkedUpCharge = {
  id: string;
  name: string;
  disabledOptionIds: string[];
};

export type LinkedAdditionalDetail = {
  id: string;
  title: string;
  inputType: string;
};

/** Pricing data: officeId -> priceTypeId -> amount */
export type MsiPricingData = Record<string, Record<string, number>>;

/** Existing uploaded image (has ID and server URLs) */
export type ExistingImage = {
  type: 'existing';
  /** File ID for the uploaded image */
  id: string;
  /** Presigned URL for full-size image */
  url: string;
  /** Presigned URL for thumbnail */
  thumbnailUrl: string | null;
};

/** Pending image file (not yet uploaded, local preview only) */
export type PendingImage = {
  type: 'pending';
  /** The file to be uploaded */
  file: File;
  /** Local preview URL created via URL.createObjectURL() */
  previewUrl: string;
};

/** Image data for MSI thumbnail - either existing or pending */
export type MsiImage = ExistingImage | PendingImage;

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
  /** Product thumbnail image */
  image: MsiImage | null;

  // Step 2: Options
  options: LinkedOption[];

  // Step 3: UpCharges
  upcharges: LinkedUpCharge[];

  // Step 4: Additional Details
  additionalDetails: LinkedAdditionalDetail[];

  // Step 5: Pricing
  msiPricing: MsiPricingData;

  // Edit-specific fields (optional)
  version?: number;
  isLoaded?: boolean;
};

export type WizardAction =
  | { type: 'LOAD_MSI'; payload: WizardState }
  | { type: 'SET_BASIC_INFO'; payload: Partial<WizardState> }
  | {
      type: 'SET_CATEGORY';
      payload: { categoryId: string; categoryName: string };
    }
  | { type: 'SET_IMAGE'; payload: MsiImage }
  | { type: 'REMOVE_IMAGE' }
  | { type: 'ADD_OFFICE'; payload: string }
  | { type: 'REMOVE_OFFICE'; payload: string }
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
  | {
      type: 'SET_MSI_PRICE';
      payload: { officeId: string; priceTypeId: string; amount: number };
    }
  | { type: 'RESET' };

// ============================================================================
// Initial State
// ============================================================================

export const initialWizardState: WizardState = {
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
  image: null,
  options: [],
  upcharges: [],
  additionalDetails: [],
  msiPricing: {},
};

// ============================================================================
// Reducer
// ============================================================================

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case 'LOAD_MSI':
      return { ...action.payload, isLoaded: true };
    case 'SET_BASIC_INFO':
      return { ...state, ...action.payload };
    case 'SET_CATEGORY':
      return {
        ...state,
        categoryId: action.payload.categoryId,
        categoryName: action.payload.categoryName,
      };
    case 'SET_IMAGE':
      return { ...state, image: action.payload };
    case 'REMOVE_IMAGE':
      return { ...state, image: null };
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
    case 'SET_MSI_PRICE': {
      const { officeId, priceTypeId, amount } = action.payload;
      return {
        ...state,
        msiPricing: {
          ...state.msiPricing,
          [officeId]: {
            ...state.msiPricing[officeId],
            [priceTypeId]: amount,
          },
        },
      };
    }
    case 'RESET':
      return initialWizardState;
    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

export type WizardContextType = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  setBasicInfo: (info: Partial<WizardState>) => void;
  setCategory: (categoryId: string, categoryName: string) => void;
  setImage: (image: MsiImage) => void;
  removeImage: () => void;
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
  setMsiPrice: (officeId: string, priceTypeId: string, amount: number) => void;
};

export const WizardContext = createContext<WizardContextType | null>(null);

/**
 * Hook to access wizard context.
 * Must be used within a wizard provider (CreateWizard).
 */
export function useWizard(): WizardContextType {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a Wizard provider');
  }
  return context;
}
