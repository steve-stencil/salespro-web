/**
 * User filter bar component.
 * Provides search and office filter for the users list.
 */
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import { useState, useEffect } from 'react';

import { useOfficesList } from '../../hooks/useOffices';

import type { SelectChangeEvent } from '@mui/material/Select';

interface UserFiltersProps {
  onSearchChange: (search: string) => void;
  onOfficeChange: (officeId: string) => void;
  onActiveChange: (isActive: boolean | undefined) => void;
  initialSearch?: string;
  initialOfficeId?: string;
  initialIsActive?: boolean;
}

/**
 * Filter bar for users list.
 * Includes search input, office dropdown, and status filter.
 */
export function UserFilters({
  onSearchChange,
  onOfficeChange,
  onActiveChange,
  initialSearch = '',
  initialOfficeId = '',
  initialIsActive,
}: UserFiltersProps): React.ReactElement {
  const [search, setSearch] = useState(initialSearch);
  const [officeId, setOfficeId] = useState(initialOfficeId);
  const [activeFilter, setActiveFilter] = useState<string>(
    initialIsActive === undefined
      ? 'all'
      : initialIsActive
        ? 'active'
        : 'inactive',
  );

  const { data: officesData } = useOfficesList(true); // Only active offices

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      onSearchChange(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, onSearchChange]);

  /**
   * Handle search input change.
   */
  function handleSearchChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): void {
    setSearch(event.target.value);
  }

  /**
   * Clear search input.
   */
  function handleClearSearch(): void {
    setSearch('');
    onSearchChange('');
  }

  /**
   * Handle office filter change.
   */
  function handleOfficeChange(event: SelectChangeEvent): void {
    const value = event.target.value;
    setOfficeId(value);
    onOfficeChange(value);
  }

  /**
   * Handle active status filter change.
   */
  function handleActiveChange(event: SelectChangeEvent): void {
    const value = event.target.value;
    setActiveFilter(value);
    if (value === 'all') {
      onActiveChange(undefined);
    } else {
      onActiveChange(value === 'active');
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 3,
        flexWrap: 'wrap',
      }}
    >
      {/* Search input */}
      <TextField
        placeholder="Search by name or email..."
        value={search}
        onChange={handleSearchChange}
        size="small"
        sx={{ minWidth: 250, flex: 1, maxWidth: 400 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />

      {/* Office filter */}
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="office-filter-label">Office</InputLabel>
        <Select
          labelId="office-filter-label"
          value={officeId}
          label="Office"
          onChange={handleOfficeChange}
        >
          <MenuItem value="">All Offices</MenuItem>
          {officesData?.offices.map(office => (
            <MenuItem key={office.id} value={office.id}>
              {office.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Status filter */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id="status-filter-label">Status</InputLabel>
        <Select
          labelId="status-filter-label"
          value={activeFilter}
          label="Status"
          onChange={handleActiveChange}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
