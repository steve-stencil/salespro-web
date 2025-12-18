/**
 * Company selection page for multi-company users.
 * Displayed after login when a user has access to multiple companies.
 */
import BusinessIcon from '@mui/icons-material/Business';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { LeapLogo } from '../components/LeapLogo';
import { useAuth } from '../hooks/useAuth';
import { useUserCompanies, useSwitchCompany } from '../hooks/useCompanies';

import type { CompanyInfo } from '../types/company';
import type { ChangeEvent } from 'react';

/**
 * Page for selecting which company to log into.
 * Shows a list of available companies for multi-company users.
 */
export function SelectCompanyPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    refreshUser,
  } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );

  // Get the intended destination from navigation state
  const from =
    (location.state as { from?: string } | null)?.from ?? '/dashboard';

  // Fetch available companies
  const { data: companiesData, isLoading: companiesLoading } = useUserCompanies(
    searchTerm || undefined,
    isAuthenticated,
  );

  const {
    switchCompany,
    isPending: isSwitching,
    error: switchError,
  } = useSwitchCompany();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      void navigate('/login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // If user doesn't need to select a company, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user && !user.canSwitchCompanies) {
      void navigate(from, { replace: true });
    }
  }, [authLoading, user, navigate, from]);

  /**
   * Get all companies from the response, combining recent and pinned.
   */
  const allCompanies = useMemo((): CompanyInfo[] => {
    if (!companiesData) return [];

    // Combine all companies, removing duplicates
    const companyMap = new Map<string, CompanyInfo>();

    // Add pinned companies first
    for (const c of companiesData.pinned) {
      companyMap.set(c.id, c);
    }
    // Add recent companies
    for (const c of companiesData.recent) {
      companyMap.set(c.id, c);
    }
    // Add search results
    for (const c of companiesData.results) {
      companyMap.set(c.id, c);
    }

    return Array.from(companyMap.values());
  }, [companiesData]);

  /**
   * Handle search input change.
   */
  function handleSearchChange(e: ChangeEvent<HTMLInputElement>): void {
    setSearchTerm(e.target.value);
  }

  /**
   * Handle company selection.
   */
  async function handleSelectCompany(companyId: string): Promise<void> {
    setSelectedCompanyId(companyId);
    try {
      await switchCompany(companyId);
      // Refresh user data to get the new active company
      await refreshUser();
      // Navigate to the dashboard
      void navigate(from, { replace: true });
    } catch {
      // Error is handled by the hook
      setSelectedCompanyId(null);
    }
  }

  /**
   * Click handler wrapper for void return.
   */
  function onCompanyClick(companyId: string): void {
    void handleSelectCompany(companyId);
  }

  // Show loading while checking auth or loading companies
  if (
    authLoading ||
    (isAuthenticated && companiesLoading && allCompanies.length === 0)
  ) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'primary.main',
        }}
      >
        <CircularProgress
          size={48}
          sx={{ color: 'white' }}
          aria-label="Loading"
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
        bgcolor: 'primary.main',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 480,
            mx: 'auto',
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <LeapLogo size="medium" color="primary" />
            </Box>
            <Typography variant="h2" component="h1" gutterBottom>
              Select Company
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Choose which company you'd like to work with
            </Typography>
          </Box>

          {switchError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to switch company. Please try again.
            </Alert>
          )}

          {/* Search field */}
          <TextField
            fullWidth
            placeholder="Search companies..."
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={isSwitching}
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Company list */}
          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
            {companiesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : allCompanies.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searchTerm
                    ? 'No companies found matching your search'
                    : 'No companies available'}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {allCompanies.map(company => {
                  const isSelected = selectedCompanyId === company.id;
                  const isCurrent = user?.company.id === company.id;

                  return (
                    <ListItemButton
                      key={company.id}
                      onClick={() => onCompanyClick(company.id)}
                      disabled={isSwitching}
                      selected={isCurrent}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {isSelected && isSwitching ? (
                          <CircularProgress size={24} />
                        ) : isCurrent ? (
                          <CheckCircleIcon color="primary" />
                        ) : (
                          <BusinessIcon color="action" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={company.name}
                        secondary={isCurrent ? 'Currently selected' : undefined}
                        primaryTypographyProps={{
                          fontWeight: isCurrent ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Paper>

          {/* User info */}
          {user && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Logged in as {user.email}
              </Typography>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
