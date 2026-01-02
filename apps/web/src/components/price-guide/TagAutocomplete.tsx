/**
 * TagAutocomplete - Multi-select autocomplete for tags with create-on-type.
 * Allows users to select existing tags or create new ones inline.
 */
import AddIcon from '@mui/icons-material/Add';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import {
  Autocomplete,
  TextField,
  Box,
  Chip,
  Typography,
  CircularProgress,
  styled,
} from '@mui/material';
import { useState, useCallback } from 'react';

import type { TagSummary } from '@shared/types';

export type TagAutocompleteProps = {
  /** Currently selected tags */
  value: TagSummary[];
  /** Callback when selection changes */
  onChange: (tags: TagSummary[]) => void;
  /** Available tags to choose from */
  options: TagSummary[];
  /** Loading state */
  loading?: boolean;
  /** Search input change callback */
  onInputChange?: (value: string) => void;
  /** Callback to create a new tag (if allowed) */
  onCreateTag?: (name: string) => Promise<TagSummary | null>;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Helper text */
  helperText?: string;
};

type OptionType = TagSummary | { isCreate: true; name: string };

function isCreateOption(
  option: OptionType,
): option is { isCreate: true; name: string } {
  return 'isCreate' in option && option.isCreate;
}

/**
 * Determines if a color is "light" and needs dark text.
 */
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

const StyledChip = styled(Chip)<{ tagcolor: string }>(({ tagcolor }) => {
  const isLight = isLightColor(tagcolor);
  return {
    backgroundColor: tagcolor,
    color: isLight ? '#1a1a1a' : '#ffffff',
    '& .MuiChip-deleteIcon': {
      color: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.7)',
      '&:hover': {
        color: isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 1)',
      },
    },
  };
});

export function TagAutocomplete({
  value,
  onChange,
  options,
  loading = false,
  onInputChange,
  onCreateTag,
  placeholder = 'Add tags...',
  label,
  disabled = false,
  error = false,
  helperText,
}: TagAutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [creating, setCreating] = useState(false);

  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, newInputValue: string) => {
      setInputValue(newInputValue);
      onInputChange?.(newInputValue);
    },
    [onInputChange],
  );

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: (OptionType | string)[]): void => {
      // Filter out string values (shouldn't happen with freeSolo=false)
      const selectedOptions = newValue.filter(
        (v): v is OptionType => typeof v !== 'string',
      );

      // Check if user selected the "Create" option
      const createOption = selectedOptions.find(isCreateOption);
      if (createOption && onCreateTag) {
        setCreating(true);
        void onCreateTag(createOption.name)
          .then(newTag => {
            if (newTag) {
              // Add the newly created tag to the selection
              const tagsWithoutCreate = selectedOptions.filter(
                (o): o is TagSummary => !isCreateOption(o),
              );
              onChange([...tagsWithoutCreate, newTag]);
            }
          })
          .finally(() => {
            setCreating(false);
            setInputValue('');
          });
        return;
      }

      // Normal selection - filter to only TagSummary objects
      onChange(
        selectedOptions.filter((o): o is TagSummary => !isCreateOption(o)),
      );
    },
    [onChange, onCreateTag],
  );

  // Build options list, adding "Create" option if there's input and no exact match
  const getFilteredOptions = useCallback((): OptionType[] => {
    const filtered: OptionType[] = options.filter(
      opt =>
        opt.name.toLowerCase().includes(inputValue.toLowerCase()) &&
        !value.some(v => v.id === opt.id),
    );

    // Add "Create" option if allowed and input doesn't match any existing tag
    if (
      onCreateTag &&
      inputValue.trim() &&
      !options.some(opt => opt.name.toLowerCase() === inputValue.toLowerCase())
    ) {
      filtered.push({ isCreate: true, name: inputValue.trim() });
    }

    return filtered;
  }, [options, inputValue, value, onCreateTag]);

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      value={value}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={getFilteredOptions()}
      getOptionLabel={option => {
        if (typeof option === 'string') return option;
        if (isCreateOption(option)) return `Create "${option.name}"`;
        return option.name;
      }}
      isOptionEqualToValue={(option, val) => {
        if (isCreateOption(option) || isCreateOption(val)) return false;
        return option.id === val.id;
      }}
      loading={loading || creating}
      disabled={disabled}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? placeholder : undefined}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {(loading || creating) && (
                  <CircularProgress color="inherit" size={20} />
                )}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        if (isCreateOption(option)) {
          return (
            <Box
              component="li"
              {...props}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AddIcon color="primary" fontSize="small" />
              <Typography>
                Create tag "<strong>{option.name}</strong>"
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            component="li"
            {...props}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: option.color,
                flexShrink: 0,
              }}
            />
            <Typography>{option.name}</Typography>
          </Box>
        );
      }}
      renderTags={(tagValues, getTagProps) =>
        tagValues.map((option, index) => {
          if (isCreateOption(option)) return null;
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <StyledChip
              key={key}
              tagcolor={option.color}
              label={option.name}
              size="small"
              icon={<LocalOfferIcon />}
              {...tagProps}
            />
          );
        })
      }
    />
  );
}
