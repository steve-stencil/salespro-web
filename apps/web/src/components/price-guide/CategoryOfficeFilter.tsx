/**
 * Office filter dropdown for price guide categories.
 * Only applies at root level, disabled when inside a category.
 */
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';

import { useOfficesList } from '../../hooks/useOffices';

import type { SelectChangeEvent } from '@mui/material/Select';

type CategoryOfficeFilterProps = {
  /** Selected office IDs. Empty array means "All Offices". */
  selectedOfficeIds: string[];
  /** Callback when selection changes. */
  onChange: (officeIds: string[]) => void;
  /** Whether the filter is disabled (e.g., when inside a category). */
  disabled?: boolean;
};

/**
 * Office filter dropdown for filtering categories by office.
 * Shows only offices the user has access to.
 * Disabled with tooltip when navigated inside a category.
 */
export function CategoryOfficeFilter({
  selectedOfficeIds,
  onChange,
  disabled = false,
}: CategoryOfficeFilterProps): React.ReactElement {
  const { data: officesData, isLoading } = useOfficesList();
  const offices = officesData?.offices ?? [];

  function handleChange(event: SelectChangeEvent<string[]>): void {
    const value = event.target.value;
    onChange(typeof value === 'string' ? value.split(',') : value);
  }

  const selectContent = (
    <FormControl size="small" sx={{ minWidth: 200 }} disabled={disabled}>
      <InputLabel id="office-filter-label">Office</InputLabel>
      <Select
        labelId="office-filter-label"
        id="office-filter"
        multiple
        value={selectedOfficeIds}
        onChange={handleChange}
        label="Office"
        renderValue={selected => {
          if (selected.length === 0) return 'All Offices';
          if (selected.length === 1) {
            const office = offices.find(o => o.id === selected[0]);
            return office?.name ?? 'Unknown';
          }
          return `${selected.length} offices`;
        }}
      >
        <MenuItem value="" disabled={selectedOfficeIds.length === 0}>
          <em>All Offices</em>
        </MenuItem>
        {isLoading ? (
          <MenuItem disabled>Loading offices...</MenuItem>
        ) : (
          offices.map(office => (
            <MenuItem key={office.id} value={office.id}>
              {office.name}
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );

  if (disabled) {
    return (
      <Tooltip
        title="Office filter only applies at root level"
        placement="bottom"
      >
        <span>{selectContent}</span>
      </Tooltip>
    );
  }

  return selectContent;
}
