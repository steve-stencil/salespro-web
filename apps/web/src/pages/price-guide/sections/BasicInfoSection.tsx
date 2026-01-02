/**
 * Basic Info Section Component.
 * Handles name, category, measurement type, note, default qty, show switch, tag settings, and thumbnail.
 */

import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ClearIcon from '@mui/icons-material/Clear';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { flattenCategoryTree } from '@shared/utils';
import { useMemo, useCallback, useState } from 'react';

import { ImagePicker } from '../../../components/price-guide/ImagePicker';
import { useCategoryTree } from '../../../hooks/usePriceGuide';

import type { SelectedImageData } from '../../../components/price-guide/ImagePicker';
import type { WizardState } from '../../../components/price-guide/wizard/WizardContext';
import type { SelectChangeEvent } from '@mui/material/Select';

// ============================================================================
// Types
// ============================================================================

/** Thumbnail image data for display */
type ThumbnailImageData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export type BasicInfoSectionProps = {
  state: WizardState;
  setBasicInfo: (info: Partial<WizardState>) => void;
  setCategory: (categoryId: string, categoryName: string) => void;
  /** Current thumbnail image data (for display) */
  thumbnailImage: ThumbnailImageData | null;
  /** Currently selected thumbnail image ID */
  thumbnailImageId: string | null;
  /** Callback when thumbnail selection changes */
  onThumbnailChange: (imageId: string | null) => void;
};

// ============================================================================
// Constants
// ============================================================================

const MEASUREMENT_TYPES = [
  { value: 'each', label: 'Each' },
  { value: 'sqft', label: 'Square Feet' },
  { value: 'linear_ft', label: 'Linear Feet' },
  { value: 'united_inches', label: 'United Inches' },
  { value: 'pair', label: 'Pair' },
];

// ============================================================================
// Main Component
// ============================================================================

/**
 * Section for editing basic MSI information.
 */
export function BasicInfoSection({
  state,
  setBasicInfo,
  setCategory,
  thumbnailImage,
  thumbnailImageId,
  onThumbnailChange,
}: BasicInfoSectionProps): React.ReactElement {
  // State for image picker dialog
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  // Track selected image data locally for immediate display after selection
  const [selectedImageData, setSelectedImageData] =
    useState<SelectedImageData | null>(null);

  // Queries
  const { data: categoryData, isLoading: isLoadingCategories } =
    useCategoryTree();

  // Flatten categories for autocomplete
  const flatCategories = useMemo(() => {
    if (!categoryData?.categories) return [];
    return flattenCategoryTree(categoryData.categories).map(cat => ({
      id: cat.id,
      name: cat.name,
      depth: cat.depth,
      fullPath: Array(cat.depth).fill('').join('  ') + cat.name,
    }));
  }, [categoryData]);

  // Selected category for autocomplete
  const selectedCategory = useMemo(() => {
    return flatCategories.find(c => c.id === state.categoryId) ?? null;
  }, [flatCategories, state.categoryId]);

  // Handlers
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBasicInfo({ name: e.target.value });
    },
    [setBasicInfo],
  );

  const handleCategoryChange = useCallback(
    (_: unknown, value: { id: string; name: string } | null) => {
      if (value) {
        setCategory(value.id, value.name);
      } else {
        setCategory('', '');
      }
    },
    [setCategory],
  );

  const handleMeasurementTypeChange = useCallback(
    (e: SelectChangeEvent) => {
      setBasicInfo({ measurementType: e.target.value });
    },
    [setBasicInfo],
  );

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBasicInfo({ note: e.target.value });
    },
    [setBasicInfo],
  );

  const handleDefaultQtyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 0) {
        setBasicInfo({ defaultQty: value });
      }
    },
    [setBasicInfo],
  );

  const handleShowSwitchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBasicInfo({ showSwitch: e.target.checked });
    },
    [setBasicInfo],
  );

  const handleTagTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBasicInfo({ tagTitle: e.target.value });
    },
    [setBasicInfo],
  );

  const handleTagRequiredChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBasicInfo({ tagRequired: e.target.checked });
    },
    [setBasicInfo],
  );

  // Image picker handlers
  const handleOpenImagePicker = useCallback(() => {
    setIsImagePickerOpen(true);
  }, []);

  const handleCloseImagePicker = useCallback(() => {
    setIsImagePickerOpen(false);
  }, []);

  const handleImageSelectionChange = useCallback(
    (imageIds: string[], selectedImages: SelectedImageData[]) => {
      // Single selection mode - take first image or null
      const newThumbnailId = imageIds.length > 0 ? imageIds[0]! : null;
      const newImageData =
        selectedImages.length > 0 ? selectedImages[0]! : null;

      // Store the selected image data for immediate display
      setSelectedImageData(newImageData);
      onThumbnailChange(newThumbnailId);
      setIsImagePickerOpen(false);
    },
    [onThumbnailChange],
  );

  const handleClearThumbnail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Clear both the ID and local display data
      setSelectedImageData(null);
      onThumbnailChange(null);
    },
    [onThumbnailChange],
  );

  // Get thumbnail URL for display
  // thumbnailImageId is the source of truth - if null, show nothing
  // If set, prefer locally selected data (for immediate display), fallback to API data
  const displayImage =
    thumbnailImageId === null
      ? null
      : selectedImageData
        ? {
            url: selectedImageData.thumbnailUrl ?? selectedImageData.imageUrl,
            name: selectedImageData.name,
          }
        : thumbnailImage
          ? {
              url: thumbnailImage.thumbnailUrl ?? thumbnailImage.imageUrl,
              name: thumbnailImage.name,
            }
          : null;

  const thumbnailUrl = displayImage?.url ?? null;
  const thumbnailName = displayImage?.name ?? 'Thumbnail';

  return (
    <Stack spacing={3} sx={{ maxWidth: 600 }}>
      {/* Thumbnail and Name Row */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* Product Thumbnail - Click to select from library */}
        <Box>
          <Box
            onClick={handleOpenImagePicker}
            sx={{
              position: 'relative',
              width: 150,
              height: 150,
              border: '2px dashed',
              borderColor: thumbnailUrl ? '#e0e0e0' : '#bdbdbd',
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backgroundColor: '#fff',
              overflow: 'hidden',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            {thumbnailUrl ? (
              <>
                <Box
                  component="img"
                  src={thumbnailUrl}
                  alt={thumbnailName}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {/* Remove button overlay */}
                <IconButton
                  onClick={handleClearThumbnail}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'error.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'error.dark',
                    },
                  }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  p: 2,
                }}
              >
                <AddPhotoAlternateIcon
                  sx={{ fontSize: 40, color: 'action.disabled' }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  align="center"
                >
                  Click to select
                  <br />
                  from library
                </Typography>
              </Box>
            )}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            Thumbnail Image
          </Typography>
        </Box>

        {/* Name */}
        <TextField
          label="Item Name"
          value={state.name}
          onChange={handleNameChange}
          required
          fullWidth
          placeholder="e.g., Double Hung Window"
          helperText="Enter a descriptive name for this item"
          sx={{ flex: 1 }}
        />
      </Box>

      {/* Image Picker Dialog */}
      <ImagePicker
        open={isImagePickerOpen}
        onClose={handleCloseImagePicker}
        selectedImageIds={thumbnailImageId ? [thumbnailImageId] : []}
        onSelectionChange={handleImageSelectionChange}
        multiple={false}
        title="Select Thumbnail Image"
      />

      {/* Category */}
      <Autocomplete
        options={flatCategories}
        value={selectedCategory}
        onChange={handleCategoryChange}
        getOptionLabel={option => option.name}
        loading={isLoadingCategories}
        renderInput={params => (
          <TextField
            {...params}
            label="Category"
            required
            placeholder="Select a category"
            helperText="Choose which category this item belongs to"
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <Box sx={{ pl: option.depth * 2 }}>{option.name}</Box>
          </li>
        )}
        isOptionEqualToValue={(option, value) => option.id === value.id}
      />

      {/* Measurement Type */}
      <FormControl fullWidth required>
        <InputLabel>Measurement Type</InputLabel>
        <Select
          value={state.measurementType}
          onChange={handleMeasurementTypeChange}
          label="Measurement Type"
        >
          {MEASUREMENT_TYPES.map(type => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>How this item is measured and priced</FormHelperText>
      </FormControl>

      {/* Note */}
      <TextField
        label="Note"
        value={state.note}
        onChange={handleNoteChange}
        fullWidth
        multiline
        rows={2}
        placeholder="Optional notes about this item"
      />

      {/* Default Quantity */}
      <TextField
        label="Default Quantity"
        type="number"
        value={state.defaultQty}
        onChange={handleDefaultQtyChange}
        fullWidth
        inputProps={{ min: 0 }}
        helperText="Default quantity when adding to a measure sheet"
      />

      {/* Show Switch */}
      <FormControlLabel
        control={
          <Switch
            checked={state.showSwitch}
            onChange={handleShowSwitchChange}
          />
        }
        label="Show toggle switch on measure sheet"
      />

      {/* Tag Settings */}
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Tag Settings (Optional)
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Tag Title"
            value={state.tagTitle}
            onChange={handleTagTitleChange}
            fullWidth
            size="small"
            placeholder="e.g., Room Location"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={state.tagRequired}
                onChange={handleTagRequiredChange}
                size="small"
              />
            }
            label="Tag is required"
          />
        </Stack>
      </Box>
    </Stack>
  );
}
