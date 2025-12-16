/**
 * Office filters component.
 * Search, status filter, and sort controls for offices list.
 */
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';

import type { SelectChangeEvent } from '@mui/material/Select';

/** Filter options for office status */
export type OfficeStatusFilter = 'all' | 'active' | 'inactive';

/** Sort options for offices */
export type OfficeSortOption =
  | 'name-asc'
  | 'name-desc'
  | 'created-desc'
  | 'users';

interface OfficeFiltersProps {
  searchQuery: string;
  statusFilter: OfficeStatusFilter;
  sortOption: OfficeSortOption;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: OfficeStatusFilter) => void;
  onSortChange: (value: OfficeSortOption) => void;
  onClearFilters: () => void;
}

/**
 * Search and filter controls for offices list.
 */
export function OfficeFilters({
  searchQuery,
  statusFilter,
  sortOption,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onClearFilters,
}: OfficeFiltersProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 3,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <TextField
        placeholder="Search offices..."
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        size="small"
        sx={{ minWidth: 250 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          },
        }}
        data-testid="offices-search-input"
      />

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id="office-status-filter-label">Status</InputLabel>
        <Select
          labelId="office-status-filter-label"
          value={statusFilter}
          label="Status"
          onChange={(e: SelectChangeEvent) =>
            onStatusChange(e.target.value as OfficeStatusFilter)
          }
          data-testid="offices-status-filter"
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="office-sort-label">Sort By</InputLabel>
        <Select
          labelId="office-sort-label"
          value={sortOption}
          label="Sort By"
          onChange={(e: SelectChangeEvent) =>
            onSortChange(e.target.value as OfficeSortOption)
          }
          data-testid="offices-sort-select"
        >
          <MenuItem value="name-asc">Name (A-Z)</MenuItem>
          <MenuItem value="name-desc">Name (Z-A)</MenuItem>
          <MenuItem value="created-desc">Newest First</MenuItem>
          <MenuItem value="users">Most Users</MenuItem>
        </Select>
      </FormControl>

      {hasActiveFilters && (
        <Button
          variant="text"
          size="small"
          startIcon={<FilterListIcon />}
          onClick={onClearFilters}
        >
          Clear Filters
        </Button>
      )}
    </Box>
  );
}
