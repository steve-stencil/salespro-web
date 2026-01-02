/**
 * Basic Info Step Component.
 * Step 1 of the Create MSI Wizard.
 */

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { flattenCategoryTree } from '@shared/utils';
import { useMemo, useCallback } from 'react';

import { useOfficesList } from '../../../hooks/useOffices';
import { useCategoryTree } from '../../../hooks/usePriceGuide';

import { useWizard } from './WizardContext';

import type { SelectChangeEvent } from '@mui/material/Select';

// ============================================================================
// Measurement Type Options
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

export function BasicInfoStep(): React.ReactElement {
  const { state, setBasicInfo, setCategory } = useWizard();

  // Queries
  const { data: categoryData, isLoading: isLoadingCategories } =
    useCategoryTree();
  const { data: officesData, isLoading: isLoadingOffices } = useOfficesList();

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

  const handleOfficesChange = useCallback(
    (officeId: string, checked: boolean) => {
      if (checked) {
        setBasicInfo({ officeIds: [...state.officeIds, officeId] });
      } else {
        setBasicInfo({
          officeIds: state.officeIds.filter(id => id !== officeId),
        });
      }
    },
    [setBasicInfo, state.officeIds],
  );

  const handleSelectAllOffices = useCallback(() => {
    if (!officesData?.offices) return;
    const allIds = officesData.offices.map(o => o.id);
    if (state.officeIds.length === allIds.length) {
      setBasicInfo({ officeIds: [] });
    } else {
      setBasicInfo({ officeIds: allIds });
    }
  }, [officesData, state.officeIds.length, setBasicInfo]);

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Basic Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Enter the basic details for your measure sheet item.
      </Typography>

      <Stack spacing={3} sx={{ maxWidth: 600 }}>
        {/* Name */}
        <TextField
          label="Item Name"
          value={state.name}
          onChange={handleNameChange}
          required
          fullWidth
          placeholder="e.g., Double Hung Window"
          helperText="Enter a descriptive name for this item"
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

        {/* Offices */}
        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Typography variant="subtitle2">
              Offices{' '}
              <Typography component="span" color="error">
                *
              </Typography>
            </Typography>
            <Chip
              label={
                state.officeIds.length === officesData?.offices.length
                  ? 'Deselect All'
                  : 'Select All'
              }
              size="small"
              onClick={handleSelectAllOffices}
              variant="outlined"
            />
          </Box>
          <FormHelperText sx={{ mb: 1 }}>
            Select which offices can use this item
          </FormHelperText>
          {isLoadingOffices ? (
            <Typography variant="body2" color="text.secondary">
              Loading offices...
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {officesData?.offices.map(office => (
                <FormControlLabel
                  key={office.id}
                  control={
                    <Checkbox
                      checked={state.officeIds.includes(office.id)}
                      onChange={e =>
                        handleOfficesChange(office.id, e.target.checked)
                      }
                      size="small"
                    />
                  }
                  label={office.name}
                  sx={{
                    border: 1,
                    borderColor: state.officeIds.includes(office.id)
                      ? 'primary.main'
                      : 'divider',
                    borderRadius: 1,
                    px: 1,
                    m: 0,
                    bgcolor: state.officeIds.includes(office.id)
                      ? 'primary.50'
                      : 'transparent',
                  }}
                />
              ))}
            </Box>
          )}
          {state.officeIds.length === 0 && (
            <FormHelperText error>
              At least one office is required
            </FormHelperText>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
