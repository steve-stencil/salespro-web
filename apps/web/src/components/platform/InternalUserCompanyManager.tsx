/**
 * Internal User Company Manager Component
 *
 * A component for managing which companies an internal user can access.
 * Platform admins can use this to restrict internal users to specific companies.
 *
 * Features:
 * - View current company restrictions
 * - Add companies to restriction list
 * - Remove companies from restriction list
 * - Visual indicator for unrestricted vs restricted access
 */
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState, useMemo } from 'react';

import {
  useInternalUserCompanies,
  useAddInternalUserCompany,
  useRemoveInternalUserCompany,
  usePlatformCompanies,
} from '../../hooks/usePlatform';
import { handleApiError } from '../../lib/api-client';

import type { PlatformCompany } from '../../types/platform';

type InternalUserCompanyManagerProps = {
  /** The internal user's ID */
  userId: string;
  /** The internal user's email (for display) */
  userEmail: string;
  /** Whether the user can edit (has manage permission) */
  canEdit?: boolean;
};

/**
 * Component for managing an internal user's company access restrictions.
 */
export function InternalUserCompanyManager({
  userId,
  userEmail,
  canEdit = true,
}: InternalUserCompanyManagerProps): React.ReactElement {
  const [selectedCompany, setSelectedCompany] =
    useState<PlatformCompany | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    companyId: string;
    companyName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const {
    data: companiesData,
    isLoading: loadingCompanies,
    error: companiesError,
  } = useInternalUserCompanies(userId);

  const { data: platformCompaniesData, isLoading: loadingPlatformCompanies } =
    usePlatformCompanies();

  // Mutations
  const addCompanyMutation = useAddInternalUserCompany();
  const removeCompanyMutation = useRemoveInternalUserCompany();

  // Filter out companies already granted
  const availableCompanies = useMemo(() => {
    if (!platformCompaniesData?.companies || !companiesData) {
      return [];
    }

    const grantedIds = new Set(companiesData.companies.map(c => c.id));
    return platformCompaniesData.companies.filter(c => !grantedIds.has(c.id));
  }, [platformCompaniesData, companiesData]);

  /**
   * Handles adding a company to the user's access list.
   */
  async function handleAddCompany(): Promise<void> {
    if (!selectedCompany) return;

    setError(null);
    try {
      await addCompanyMutation.mutateAsync({
        userId,
        companyId: selectedCompany.id,
      });
      setSelectedCompany(null);
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handles removing a company from the user's access list.
   */
  async function handleRemoveCompany(): Promise<void> {
    if (!confirmRemove) return;

    setError(null);
    try {
      await removeCompanyMutation.mutateAsync({
        userId,
        companyId: confirmRemove.companyId,
      });
      setConfirmRemove(null);
    } catch (err) {
      setError(handleApiError(err));
      setConfirmRemove(null);
    }
  }

  const isLoading = loadingCompanies || loadingPlatformCompanies;
  const isAddPending = addCompanyMutation.isPending;
  const isRemovePending = removeCompanyMutation.isPending;

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (companiesError) {
    return (
      <Alert severity="error">
        Failed to load company access data. Please try again.
      </Alert>
    );
  }

  const hasRestrictions = companiesData?.hasRestrictions ?? false;
  const companies = companiesData?.companies ?? [];

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <BusinessIcon color="primary" />
          <Typography variant="h6" component="h3">
            Company Access
          </Typography>
          {hasRestrictions ? (
            <Chip
              size="small"
              label="Restricted"
              color="warning"
              variant="outlined"
            />
          ) : (
            <Chip
              size="small"
              label="Unrestricted"
              color="success"
              variant="outlined"
              icon={<LockOpenIcon />}
            />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Info alert explaining the restriction model */}
        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
          {hasRestrictions ? (
            <>
              <strong>{userEmail}</strong> can only access the companies listed
              below. Remove all restrictions to grant full platform access.
            </>
          ) : (
            <>
              <strong>{userEmail}</strong> has unrestricted access to all
              companies on the platform. Add a company below to restrict access.
            </>
          )}
        </Alert>

        {/* Add company form */}
        {canEdit && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Autocomplete
              options={availableCompanies}
              value={selectedCompany}
              onChange={(_, newValue) => setSelectedCompany(newValue)}
              getOptionLabel={option => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loadingPlatformCompanies}
              disabled={isAddPending}
              sx={{ flex: 1 }}
              renderInput={params => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Select a company to add..."
                  label="Add Company Access"
                />
              )}
              noOptionsText={
                companies.length > 0
                  ? 'All available companies have been added'
                  : 'No companies available'
              }
            />
            <Button
              variant="contained"
              onClick={() => void handleAddCompany()}
              disabled={!selectedCompany || isAddPending}
              startIcon={
                isAddPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <AddIcon />
                )
              }
            >
              Add
            </Button>
          </Box>
        )}

        {/* Company list */}
        {companies.length > 0 ? (
          <List dense>
            {companies.map(company => (
              <ListItem key={company.id} divider>
                <ListItemIcon>
                  <BusinessIcon
                    color={company.isActive ? 'action' : 'disabled'}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={company.name}
                  secondary={
                    <>
                      Added {new Date(company.grantedAt).toLocaleDateString()}
                      {company.grantedBy && ` by ${company.grantedBy.email}`}
                      {!company.isActive && ' (Inactive company)'}
                    </>
                  }
                />
                {canEdit && (
                  <ListItemSecondaryAction>
                    <Tooltip title="Remove access">
                      <IconButton
                        edge="end"
                        onClick={() =>
                          setConfirmRemove({
                            companyId: company.id,
                            companyName: company.name,
                          })
                        }
                        disabled={isRemovePending}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No company restrictions. User has access to all companies.
          </Typography>
        )}

        {/* Confirm remove dialog */}
        <Dialog
          open={!!confirmRemove}
          onClose={() => setConfirmRemove(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Remove Company Access</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to remove access to{' '}
              <strong>{confirmRemove?.companyName}</strong> for {userEmail}?
              {companies.length === 1 && (
                <>
                  <br />
                  <br />
                  <strong>Note:</strong> This is the last restriction. Removing
                  it will grant the user unrestricted access to all companies.
                </>
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setConfirmRemove(null)}
              disabled={isRemovePending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRemoveCompany()}
              color="error"
              variant="contained"
              disabled={isRemovePending}
              startIcon={
                isRemovePending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DeleteIcon />
                )
              }
            >
              Remove
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
