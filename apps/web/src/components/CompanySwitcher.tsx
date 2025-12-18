/**
 * Company Switcher Component
 *
 * A dropdown component for switching between companies for multi-company users.
 * Features:
 * - Real-time search filtering
 * - Recent companies section (last 5 accessed)
 * - Pinned companies section (user favorites)
 * - Current company highlighted
 * - Keyboard navigation support
 */
import BusinessIcon from '@mui/icons-material/Business';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState, useMemo } from 'react';

import { useAuth } from '../hooks/useAuth';
import {
  useUserCompanies,
  useSwitchCompany,
  usePinCompany,
} from '../hooks/useCompanies';

import type { CompanyInfo } from '../types/company';

/**
 * Company item in the list with pin toggle.
 */
function CompanyListItem({
  company,
  isActive,
  onSelect,
  onTogglePin,
  isPinPending,
}: {
  company: CompanyInfo;
  isActive: boolean;
  onSelect: (companyId: string) => void;
  onTogglePin: (companyId: string, isPinned: boolean) => void;
  isPinPending: boolean;
}): React.ReactElement {
  const handlePinClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onTogglePin(company.id, !company.isPinned);
  };

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Tooltip title={company.isPinned ? 'Unpin company' : 'Pin company'}>
          <IconButton
            edge="end"
            size="small"
            onClick={handlePinClick}
            disabled={isPinPending}
            aria-label={company.isPinned ? 'Unpin company' : 'Pin company'}
          >
            {company.isPinned ? (
              <PushPinIcon fontSize="small" color="primary" />
            ) : (
              <PushPinOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      }
    >
      <ListItemButton
        onClick={() => onSelect(company.id)}
        selected={isActive}
        sx={{ pr: 6 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          {isActive ? (
            <CheckIcon color="primary" fontSize="small" />
          ) : (
            <BusinessIcon fontSize="small" color="action" />
          )}
        </ListItemIcon>
        <ListItemText
          primary={company.name}
          primaryTypographyProps={{
            variant: 'body2',
            fontWeight: isActive ? 600 : 400,
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Company Switcher dropdown component.
 * Only renders if user has access to multiple companies.
 */
export function CompanySwitcher(): React.ReactElement | null {
  const { user, refreshUser } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Extract values early for hooks dependencies
  const canSwitch = Boolean(user?.canSwitchCompanies);
  const currentCompanyId = user?.company.id;

  const { data: companiesData, isLoading } = useUserCompanies(
    searchTerm || undefined,
    canSwitch && Boolean(anchorEl), // Only fetch when popover is open and user can switch
  );

  const { switchCompany, isPending: isSwitchPending } = useSwitchCompany();
  const { pinCompany, isPending: isPinPending } = usePinCompany();

  // Combine and deduplicate companies for display
  // Must be called before any early returns to satisfy Rules of Hooks
  const { recentCompanies, pinnedCompanies, allCompanies } = useMemo(() => {
    if (!companiesData || !currentCompanyId) {
      return { recentCompanies: [], pinnedCompanies: [], allCompanies: [] };
    }

    // Filter out current company from recent (it's shown as active)
    const recent = companiesData.recent.filter(c => c.id !== currentCompanyId);

    // Pinned companies (exclude current)
    const pinned = companiesData.pinned.filter(c => c.id !== currentCompanyId);

    // All results (exclude those already shown in recent/pinned)
    const shownIds = new Set([
      currentCompanyId,
      ...recent.map(c => c.id),
      ...pinned.map(c => c.id),
    ]);
    const results = companiesData.results.filter(c => !shownIds.has(c.id));

    return {
      recentCompanies: recent,
      pinnedCompanies: pinned,
      allCompanies: results,
    };
  }, [companiesData, currentCompanyId]);

  const open = Boolean(anchorEl);

  // Don't render if user can't switch companies
  if (!canSwitch || !user) {
    return null;
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
    setSearchTerm('');
  };

  const handleClose = (): void => {
    setAnchorEl(null);
    setSearchTerm('');
  };

  const handleSelectCompany = async (companyId: string): Promise<void> => {
    if (companyId === user.company.id) {
      handleClose();
      return;
    }

    try {
      await switchCompany(companyId);
      await refreshUser();
      handleClose();
      // Page will refresh with new company context
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch company:', error);
    }
  };

  const handleTogglePin = async (
    companyId: string,
    isPinned: boolean,
  ): Promise<void> => {
    try {
      await pinCompany(companyId, isPinned);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const hasAnyCompanies =
    recentCompanies.length > 0 ||
    pinnedCompanies.length > 0 ||
    allCompanies.length > 0;

  return (
    <>
      <Button
        onClick={handleClick}
        endIcon={<ExpandMoreIcon />}
        startIcon={<BusinessIcon />}
        sx={{
          textTransform: 'none',
          color: 'text.primary',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        aria-label="Switch company"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ maxWidth: 150, fontWeight: 500 }}
        >
          {user.company.name}
        </Typography>
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { width: 320, maxHeight: 480 },
          },
        }}
      >
        {/* Search input */}
        <Box sx={{ p: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search companies..."
            value={searchTerm}
            onChange={handleSearchChange}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Divider />

        {/* Loading state */}
        {isLoading || isSwitchPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List
            dense
            sx={{ maxHeight: 360, overflow: 'auto', py: 0 }}
            subheader={<li />}
          >
            {/* Current company */}
            <ListSubheader
              sx={{ bgcolor: 'background.paper', lineHeight: 2.5 }}
            >
              Current
            </ListSubheader>
            <CompanyListItem
              company={{ ...user.company, isPinned: false }}
              isActive={true}
              onSelect={() => handleClose()}
              onTogglePin={(id, pinned) => void handleTogglePin(id, pinned)}
              isPinPending={isPinPending}
            />

            {/* Recent companies */}
            {recentCompanies.length > 0 && (
              <>
                <ListSubheader
                  sx={{ bgcolor: 'background.paper', lineHeight: 2.5 }}
                >
                  Recent
                </ListSubheader>
                {recentCompanies.map(company => (
                  <CompanyListItem
                    key={company.id}
                    company={company}
                    isActive={false}
                    onSelect={() => void handleSelectCompany(company.id)}
                    onTogglePin={(id, pinned) =>
                      void handleTogglePin(id, pinned)
                    }
                    isPinPending={isPinPending}
                  />
                ))}
              </>
            )}

            {/* Pinned companies */}
            {pinnedCompanies.length > 0 && (
              <>
                <ListSubheader
                  sx={{ bgcolor: 'background.paper', lineHeight: 2.5 }}
                >
                  Pinned
                </ListSubheader>
                {pinnedCompanies.map(company => (
                  <CompanyListItem
                    key={company.id}
                    company={company}
                    isActive={false}
                    onSelect={() => void handleSelectCompany(company.id)}
                    onTogglePin={(id, pinned) =>
                      void handleTogglePin(id, pinned)
                    }
                    isPinPending={isPinPending}
                  />
                ))}
              </>
            )}

            {/* All companies (search results) */}
            {allCompanies.length > 0 && (
              <>
                <ListSubheader
                  sx={{ bgcolor: 'background.paper', lineHeight: 2.5 }}
                >
                  {searchTerm ? 'Search Results' : 'All Companies'}
                  {companiesData && ` (${companiesData.total})`}
                </ListSubheader>
                {allCompanies.map(company => (
                  <CompanyListItem
                    key={company.id}
                    company={company}
                    isActive={false}
                    onSelect={() => void handleSelectCompany(company.id)}
                    onTogglePin={(id, pinned) =>
                      void handleTogglePin(id, pinned)
                    }
                    isPinPending={isPinPending}
                  />
                ))}
              </>
            )}

            {/* No results */}
            {!hasAnyCompanies && searchTerm && (
              <ListItem>
                <ListItemText
                  primary="No companies found"
                  secondary="Try a different search term"
                  primaryTypographyProps={{ color: 'text.secondary' }}
                />
              </ListItem>
            )}
          </List>
        )}
      </Popover>
    </>
  );
}
