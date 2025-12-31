/**
 * TagFilterSelect - Multi-select dropdown for filtering items by tags.
 * Shows a clean count-based display matching other filter dropdowns,
 * with color dots for visual tag identification in the menu.
 */
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Checkbox,
  ListItemText,
  styled,
} from '@mui/material';
import { useCallback } from 'react';

import type { SelectChangeEvent } from '@mui/material';
import type { TagSummary } from '@shared/types';

export type TagFilterSelectProps = {
  /** Currently selected tag IDs */
  value: string[];
  /** Callback when selection changes */
  onChange: (tagIds: string[]) => void;
  /** Available tags to filter by */
  tags: TagSummary[];
  /** Label for the select */
  label?: string;
  /** Size of the control */
  size?: 'small' | 'medium';
  /** Minimum width */
  minWidth?: number;
  /** Disabled state */
  disabled?: boolean;
};

/** Small color indicator dot */
const ColorDot = styled(Box)<{ tagcolor: string }>(({ tagcolor }) => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: tagcolor,
  flexShrink: 0,
  border: '1px solid rgba(255, 255, 255, 0.2)',
}));

export function TagFilterSelect({
  value,
  onChange,
  tags,
  label = 'Tags',
  size = 'small',
  minWidth = 150,
  disabled = false,
}: TagFilterSelectProps): React.ReactElement {
  const handleChange = useCallback(
    (event: SelectChangeEvent<string[]>) => {
      const newValue = event.target.value;
      onChange(typeof newValue === 'string' ? newValue.split(',') : newValue);
    },
    [onChange],
  );

  const getTagById = useCallback(
    (id: string): TagSummary | undefined => {
      return tags.find(t => t.id === id);
    },
    [tags],
  );

  /**
   * Renders the selected value in a clean, consistent format:
   * - Empty: shows nothing (placeholder from label)
   * - 1 tag: shows color dot + tag name
   * - 2+ tags: shows "{count} tags"
   */
  const renderValue = useCallback(
    (selected: string[]) => {
      if (selected.length === 0) {
        return '';
      }

      if (selected.length === 1) {
        const tag = getTagById(selected[0]);
        if (tag) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ColorDot tagcolor={tag.color} />
              <span>{tag.name}</span>
            </Box>
          );
        }
      }

      // For 2+ selections, show count (matches Categories/Offices pattern)
      return `${selected.length} tags`;
    },
    [getTagById],
  );

  return (
    <FormControl size={size} sx={{ minWidth }} disabled={disabled}>
      <InputLabel id="tag-filter-label">{label}</InputLabel>
      <Select
        labelId="tag-filter-label"
        id="tag-filter"
        multiple
        value={value}
        onChange={handleChange}
        label={label}
        renderValue={renderValue}
        MenuProps={{
          PaperProps: {
            sx: { maxHeight: 300 },
          },
        }}
      >
        {tags.length === 0 ? (
          <MenuItem disabled>
            <Typography color="text.secondary" variant="body2">
              No tags available
            </Typography>
          </MenuItem>
        ) : (
          tags.map(tag => (
            <MenuItem
              key={tag.id}
              value={tag.id}
              sx={{
                py: 0.75,
                '&.Mui-selected': {
                  backgroundColor: 'action.selected',
                },
              }}
            >
              <Checkbox
                checked={value.includes(tag.id)}
                size="small"
                sx={{ p: 0.5, mr: 1 }}
              />
              <ColorDot tagcolor={tag.color} sx={{ mr: 1.5 }} />
              <ListItemText
                primary={tag.name}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );
}
