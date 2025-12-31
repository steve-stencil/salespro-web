/**
 * MSI Edit Page Component.
 * Single page for viewing and editing a Measure Sheet Item with collapsible sections.
 *
 * Sections:
 * - Basic Information (name, category, measurement type, etc.)
 * - Offices (multi-select office assignment)
 * - Options (link/unlink options)
 * - UpCharges (link/unlink upcharges with option compatibility)
 * - Additional Details (link/unlink custom fields)
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

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
  useSetMsiThumbnail,
} from '../../hooks/usePriceGuide';
import { ApiClientError } from '../../lib/api-client';

import { AdditionalDetailsSection } from './sections/AdditionalDetailsSection';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { ImagesSection } from './sections/ImagesSection';
import { OfficesSection } from './sections/OfficesSection';
import { OptionsSection } from './sections/OptionsSection';
import { TagsSection } from './sections/TagsSection';
import { UpchargesSection } from './sections/UpchargesSection';

import type {
  LinkedAdditionalDetail,
  LinkedOption,
  LinkedUpCharge,
  PendingImage,
  WizardAction,
  WizardState,
} from '../../components/price-guide/wizard/WizardContext';
import type {
  LinkedAdditionalDetail as SharedLinkedDetail,
  LinkedOption as SharedLinkedOption,
  LinkedUpCharge as SharedLinkedUpCharge,
} from '@shared/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract a user-friendly error message from an error object.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    // Check for validation errors with details
    if (error.apiError.details && Array.isArray(error.apiError.details)) {
      const details = error.apiError.details as Array<{
        field?: string;
        message?: string;
      }>;
      const messages = details
        .map(d => (d.field ? `${d.field}: ${d.message}` : d.message))
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join('. ');
      }
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to save changes. Please try again.';
}

// ============================================================================
// State Management
// ============================================================================

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
  msiPricing: {},
  image: null,
};

function reducer(state: WizardState, action: WizardAction): WizardState {
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
      return initialState;
    default:
      return state;
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * MSI Edit Page - Single page for editing a Measure Sheet Item.
 */
export function MsiEditPage(): React.ReactElement {
  const { msiId } = useParams<{ msiId: string }>();
  const navigate = useNavigate();

  // State
  const [state, dispatch] = useReducer(reducer, initialState);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'basic-info',
    'tags',
    'images',
    'offices',
    'options',
    'upcharges',
    'additional-details',
  ]);

  // Queries & Mutations
  const { data: msiData, isLoading, error } = useMsiDetail(msiId ?? '');
  const updateMutation = useUpdateMsi();
  const syncOfficesMutation = useSyncOffices();
  const linkOptionsMutation = useLinkOptions();
  const unlinkOptionMutation = useUnlinkOption();
  const linkUpchargesMutation = useLinkUpcharges();
  const unlinkUpchargeMutation = useUnlinkUpcharge();
  const linkDetailsMutation = useLinkAdditionalDetails();
  const unlinkDetailMutation = useUnlinkAdditionalDetail();
  const setThumbnailMutation = useSetMsiThumbnail();

  // Track original state for diffing on save
  const [originalState, setOriginalState] = useState<WizardState | null>(null);

  // Track thumbnail image ID for the ImagesSection
  const [thumbnailImageId, setThumbnailImageId] = useState<string | null>(null);
  const [originalThumbnailId, setOriginalThumbnailId] = useState<string | null>(
    null,
  );

  // Load MSI data into state
  useEffect(() => {
    if (msiData?.item && !state.isLoaded) {
      const msi = msiData.item;
      const loadedState: WizardState = {
        name: msi.name,
        categoryId: msi.category.id,
        categoryName: msi.category.name,
        measurementType: msi.measurementType,
        note: msi.note ?? '',
        defaultQty: msi.defaultQty,
        showSwitch: msi.showSwitch,
        tagTitle: msi.tagTitle ?? '',
        tagRequired: msi.tagRequired,
        tagPickerOptions: (msi.tagPickerOptions ?? []) as string[],
        officeIds: msi.offices.map(o => o.id),
        // Image is now handled via images array, not single image
        image: null,
        options: msi.options.map((o: SharedLinkedOption) => ({
          id: o.optionId,
          name: o.name,
          brand: o.brand,
        })),
        upcharges: msi.upcharges.map((u: SharedLinkedUpCharge) => ({
          id: u.upchargeId,
          name: u.name,
          disabledOptionIds: [] as string[], // TODO: Load from API
        })),
        additionalDetails: msi.additionalDetails.map(
          (d: SharedLinkedDetail) => ({
            id: d.fieldId,
            title: d.title,
            inputType: d.inputType,
          }),
        ),
        msiPricing: {},
        version: msi.version,
      };
      dispatch({ type: 'LOAD_MSI', payload: loadedState });
      setOriginalState(loadedState);

      // Load thumbnail image
      const thumbId = msi.thumbnailImage?.id ?? null;
      setThumbnailImageId(thumbId);
      setOriginalThumbnailId(thumbId);
    }
  }, [msiData, state.isLoaded]);

  // Action creators
  const setBasicInfo = useCallback((info: Partial<WizardState>) => {
    dispatch({ type: 'SET_BASIC_INFO', payload: info });
  }, []);

  const setCategory = useCallback(
    (categoryId: string, categoryName: string) => {
      dispatch({ type: 'SET_CATEGORY', payload: { categoryId, categoryName } });
    },
    [],
  );

  /**
   * Handle file selection - stores the pending image in state.
   * Actual upload happens on save.
   */
  const onFileSelected = useCallback((pendingImage: PendingImage) => {
    dispatch({ type: 'SET_IMAGE', payload: pendingImage });
  }, []);

  /**
   * Handle image removal.
   * If removing an existing image, track its ID for deletion on save.
   */
  const onImageRemoved = useCallback(() => {
    // If there's an existing image being removed, mark it for deletion
    if (state.image?.type === 'existing') {
      setImageIdsToDelete(prev => [...prev, state.image!.id]);
    }
    // If it's a pending image, revoke the preview URL to free memory
    if (state.image?.type === 'pending') {
      URL.revokeObjectURL(state.image.previewUrl);
    }
    dispatch({ type: 'REMOVE_IMAGE' });
  }, [state.image]);

  const addOption = useCallback((option: LinkedOption) => {
    dispatch({ type: 'ADD_OPTION', payload: option });
  }, []);

  const removeOption = useCallback((optionId: string) => {
    dispatch({ type: 'REMOVE_OPTION', payload: optionId });
  }, []);

  const addUpcharge = useCallback((upcharge: LinkedUpCharge) => {
    dispatch({ type: 'ADD_UPCHARGE', payload: upcharge });
  }, []);

  const removeUpcharge = useCallback((upchargeId: string) => {
    dispatch({ type: 'REMOVE_UPCHARGE', payload: upchargeId });
  }, []);

  const updateUpchargeDisabledOptions = useCallback(
    (upchargeId: string, disabledOptionIds: string[]) => {
      dispatch({
        type: 'UPDATE_UPCHARGE_DISABLED_OPTIONS',
        payload: { upchargeId, disabledOptionIds },
      });
    },
    [],
  );

  const addAdditionalDetail = useCallback((detail: LinkedAdditionalDetail) => {
    dispatch({ type: 'ADD_ADDITIONAL_DETAIL', payload: detail });
  }, []);

  const removeAdditionalDetail = useCallback((detailId: string) => {
    dispatch({ type: 'REMOVE_ADDITIONAL_DETAIL', payload: detailId });
  }, []);

  // Section toggle
  const handleSectionToggle = useCallback((sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId],
    );
  }, []);

  // Validation
  const isValid = useMemo(() => {
    return (
      state.name.trim() !== '' &&
      state.categoryId !== '' &&
      state.officeIds.length > 0 &&
      state.options.length > 0
    );
  }, [state.name, state.categoryId, state.officeIds, state.options]);

  // Check if any mutation is pending
  const isSaving =
    updateMutation.isPending ||
    syncOfficesMutation.isPending ||
    linkOptionsMutation.isPending ||
    unlinkOptionMutation.isPending ||
    linkUpchargesMutation.isPending ||
    unlinkUpchargeMutation.isPending ||
    linkDetailsMutation.isPending ||
    unlinkDetailMutation.isPending ||
    setThumbnailMutation.isPending;

  // Save handler
  const handleSave = useCallback(async () => {
    if (!msiId || !isValid || state.version === undefined || !originalState)
      return;

    try {
      // 1. Update basic fields
      await updateMutation.mutateAsync({
        msiId,
        data: {
          name: state.name,
          categoryId: state.categoryId,
          measurementType: state.measurementType,
          note: state.note || undefined,
          // Ensure defaultQty is a number (form inputs may store as string)
          defaultQty: Number(state.defaultQty),
          showSwitch: state.showSwitch,
          tagTitle: state.tagTitle || undefined,
          tagRequired: state.tagRequired,
          tagPickerOptions: state.tagPickerOptions,
          version: state.version,
        },
      });

      // 2. Sync offices if changed
      const originalOfficeIds = new Set(originalState.officeIds);
      const currentOfficeIds = new Set(state.officeIds);
      const officesChanged =
        originalOfficeIds.size !== currentOfficeIds.size ||
        [...originalOfficeIds].some(id => !currentOfficeIds.has(id));

      if (officesChanged) {
        await syncOfficesMutation.mutateAsync({
          msiId,
          officeIds: state.officeIds,
          version: state.version,
        });
      }

      // 3. Handle option changes (link new, unlink removed)
      const originalOptionIds = new Set(originalState.options.map(o => o.id));
      const currentOptionIds = new Set(state.options.map(o => o.id));

      const optionsToLink = state.options
        .filter(o => !originalOptionIds.has(o.id))
        .map(o => o.id);
      const optionsToUnlink = originalState.options
        .filter(o => !currentOptionIds.has(o.id))
        .map(o => o.id);

      if (optionsToLink.length > 0) {
        await linkOptionsMutation.mutateAsync({
          msiId,
          optionIds: optionsToLink,
        });
      }
      for (const optionId of optionsToUnlink) {
        await unlinkOptionMutation.mutateAsync({ msiId, optionId });
      }

      // 4. Handle upcharge changes
      const originalUpchargeIds = new Set(
        originalState.upcharges.map(u => u.id),
      );
      const currentUpchargeIds = new Set(state.upcharges.map(u => u.id));

      const upchargesToLink = state.upcharges
        .filter(u => !originalUpchargeIds.has(u.id))
        .map(u => u.id);
      const upchargesToUnlink = originalState.upcharges
        .filter(u => !currentUpchargeIds.has(u.id))
        .map(u => u.id);

      if (upchargesToLink.length > 0) {
        await linkUpchargesMutation.mutateAsync({
          msiId,
          upchargeIds: upchargesToLink,
        });
      }
      for (const upchargeId of upchargesToUnlink) {
        await unlinkUpchargeMutation.mutateAsync({ msiId, upchargeId });
      }

      // 5. Handle additional detail changes
      const originalDetailIds = new Set(
        originalState.additionalDetails.map(d => d.id),
      );
      const currentDetailIds = new Set(state.additionalDetails.map(d => d.id));

      const detailsToLink = state.additionalDetails
        .filter(d => !originalDetailIds.has(d.id))
        .map(d => d.id);
      const detailsToUnlink = originalState.additionalDetails
        .filter(d => !currentDetailIds.has(d.id))
        .map(d => d.id);

      if (detailsToLink.length > 0) {
        await linkDetailsMutation.mutateAsync({
          msiId,
          fieldIds: detailsToLink,
        });
      }
      for (const fieldId of detailsToUnlink) {
        await unlinkDetailMutation.mutateAsync({ msiId, fieldId });
      }

      // 6. Set thumbnail if changed
      if (thumbnailImageId !== originalThumbnailId) {
        await setThumbnailMutation.mutateAsync({
          msiId,
          imageId: thumbnailImageId,
          version: state.version,
        });
      }

      void navigate('/price-guide');
    } catch {
      // Error handled by mutations
    }
  }, [
    msiId,
    isValid,
    state,
    originalState,
    thumbnailImageId,
    originalThumbnailId,
    updateMutation,
    syncOfficesMutation,
    linkOptionsMutation,
    unlinkOptionMutation,
    linkUpchargesMutation,
    unlinkUpchargeMutation,
    linkDetailsMutation,
    unlinkDetailMutation,
    setThumbnailMutation,
    navigate,
  ]);

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load measure sheet item. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ p: 3, pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={() => void navigate('/price-guide')}>
            <ArrowBackIcon />
          </IconButton>
          <Breadcrumbs>
            <Link component={RouterLink} to="/price-guide" color="inherit">
              Catalog
            </Link>
            <Typography color="text.primary">
              {state.name || 'Edit Item'}
            </Typography>
          </Breadcrumbs>
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h4" gutterBottom>
              {state.name || 'Edit Item'}
            </Typography>
            {state.categoryName && (
              <Typography variant="body2" color="text.secondary">
                {state.categoryName}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => void navigate(`/price-guide/${msiId}/pricing`)}
            >
              Pricing
            </Button>
            <Button
              variant="contained"
              startIcon={
                isSaving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              onClick={() => void handleSave()}
              disabled={!isValid || isSaving}
            >
              Save Changes
            </Button>
          </Stack>
        </Box>
      </Box>

      {updateMutation.isError && (
        <Alert severity="error" sx={{ mx: 3, mt: 2 }}>
          {getErrorMessage(updateMutation.error)}
        </Alert>
      )}

      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Basic Information */}
          <Accordion
            expanded={expandedSections.includes('basic-info')}
            onChange={() => handleSectionToggle('basic-info')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Basic Information</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <BasicInfoSection
                state={state}
                setBasicInfo={setBasicInfo}
                setCategory={setCategory}
                onFileSelected={onFileSelected}
                onImageRemoved={onImageRemoved}
              />
            </AccordionDetails>
          </Accordion>

          {/* Tags */}
          <Accordion
            expanded={expandedSections.includes('tags')}
            onChange={() => handleSectionToggle('tags')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">Tags</Typography>
                <Typography variant="body2" color="text.secondary">
                  ({msiData?.item.tags?.length ?? 0} assigned)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {msiId && <TagsSection msiId={msiId} />}
            </AccordionDetails>
          </Accordion>

          {/* Images */}
          <Accordion
            expanded={expandedSections.includes('images')}
            onChange={() => handleSectionToggle('images')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">Thumbnail Image</Typography>
                <Typography variant="body2" color="text.secondary">
                  {thumbnailImageId ? '(set)' : '(not set)'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <ImagesSection
                thumbnailImage={msiData?.item.thumbnailImage ?? null}
                thumbnailImageId={thumbnailImageId}
                onThumbnailChange={setThumbnailImageId}
              />
            </AccordionDetails>
          </Accordion>

          {/* Offices */}
          <Accordion
            expanded={expandedSections.includes('offices')}
            onChange={() => handleSectionToggle('offices')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">Offices</Typography>
                <Typography variant="body2" color="text.secondary">
                  ({state.officeIds.length} selected)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <OfficesSection state={state} setBasicInfo={setBasicInfo} />
            </AccordionDetails>
          </Accordion>

          {/* Options */}
          <Accordion
            expanded={expandedSections.includes('options')}
            onChange={() => handleSectionToggle('options')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">Options</Typography>
                <Typography variant="body2" color="text.secondary">
                  ({state.options.length} linked)
                </Typography>
                {state.options.length === 0 && (
                  <Typography variant="body2" color="error">
                    (At least 1 required)
                  </Typography>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <OptionsSection
                state={state}
                addOption={addOption}
                removeOption={removeOption}
              />
            </AccordionDetails>
          </Accordion>

          {/* UpCharges */}
          <Accordion
            expanded={expandedSections.includes('upcharges')}
            onChange={() => handleSectionToggle('upcharges')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">UpCharges</Typography>
                <Typography variant="body2" color="text.secondary">
                  ({state.upcharges.length} linked)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <UpchargesSection
                state={state}
                addUpcharge={addUpcharge}
                removeUpcharge={removeUpcharge}
                updateUpchargeDisabledOptions={updateUpchargeDisabledOptions}
              />
            </AccordionDetails>
          </Accordion>

          {/* Additional Details */}
          <Accordion
            expanded={expandedSections.includes('additional-details')}
            onChange={() => handleSectionToggle('additional-details')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">Additional Details</Typography>
                <Typography variant="body2" color="text.secondary">
                  ({state.additionalDetails.length} linked)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <AdditionalDetailsSection
                state={state}
                addAdditionalDetail={addAdditionalDetail}
                removeAdditionalDetail={removeAdditionalDetail}
              />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Box>
    </Box>
  );
}
