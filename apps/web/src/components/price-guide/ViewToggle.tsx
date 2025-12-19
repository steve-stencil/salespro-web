/**
 * View toggle component for switching between grid, table, and columns views.
 */
import GridViewIcon from '@mui/icons-material/GridView';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import { useEffect, useState } from 'react';

/** Available view modes for displaying categories. */
export type ViewMode = 'grid' | 'table' | 'columns';

const STORAGE_KEY = 'priceGuideViewMode';

type ViewToggleProps = {
  /** Currently selected view mode. */
  value: ViewMode;
  /** Callback when view mode changes. */
  onChange: (mode: ViewMode) => void;
};

/**
 * Toggle button group for switching between grid, table, and columns views.
 * Persists preference in localStorage.
 */
export function ViewToggle({
  value,
  onChange,
}: ViewToggleProps): React.ReactElement {
  const [mounted, setMounted] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'grid' || stored === 'table' || stored === 'columns') {
      onChange(stored);
    }
  }, [onChange]);

  // Save preference to localStorage when changed
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }, [value, mounted]);

  function handleChange(
    _event: React.MouseEvent<HTMLElement>,
    newValue: ViewMode | null,
  ): void {
    if (newValue !== null) {
      onChange(newValue);
    }
  }

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      size="small"
      aria-label="View mode"
    >
      <ToggleButton value="grid" aria-label="Grid view">
        <Tooltip title="Card grid view">
          <GridViewIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="table" aria-label="Table view">
        <Tooltip title="Table view">
          <TableRowsIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="columns" aria-label="Columns view">
        <Tooltip title="Miller columns view">
          <ViewWeekIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
