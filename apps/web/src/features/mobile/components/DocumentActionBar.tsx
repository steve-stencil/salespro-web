/**
 * Document Action Bar component.
 * Displays action buttons and selection summary for the template selection view.
 * Based on iOS: Bar button items in ContractObjectSelectionCollectionViewController
 */
import SortIcon from '@mui/icons-material/Sort';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { DocumentActionBarProps } from '../types/document';
import type React from 'react';

/**
 * Action bar component for template selection.
 * Shows selection count and NEXT button (and SORT on larger screens).
 *
 * @param props - Action bar props
 * @returns Action bar element
 */
export function DocumentActionBar({
  selectedCount,
  totalCount,
  canProceed,
  isLoading,
  onNext,
  onSort,
  sortMode = 'order',
}: DocumentActionBarProps): React.ReactElement {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={2}
      sx={{
        top: 'auto',
        bottom: 0,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2, sm: 3 },
        }}
      >
        {/* Selection summary */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
            }}
          >
            {selectedCount} of {totalCount} templates selected
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Sort button - visible on larger screens (iPad equivalent) */}
          {isLargeScreen && onSort && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<SortIcon />}
              onClick={onSort}
              sx={{ textTransform: 'none' }}
            >
              Sort: {sortMode === 'alphabetic' ? 'A-Z' : 'Order'}
            </Button>
          )}

          {/* NEXT button */}
          <Button
            variant="contained"
            color="primary"
            onClick={onNext}
            disabled={!canProceed || isLoading}
            sx={{
              minWidth: 100,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {isLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              'NEXT'
            )}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
