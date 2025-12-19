/**
 * Platform Companies Page
 *
 * Platform administration page for managing companies in the system.
 * Allows creating, viewing, and editing companies.
 *
 * This page is only accessible to internal users with the
 * platform:view_companies permission.
 */
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import {
  CompanyTable,
  CompanyCreateDialog,
  CompanyEditDialog,
} from '../components/platform';
import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';
import { usePlatformCompanies } from '../hooks/usePlatform';

/**
 * Page for managing platform companies.
 */
export function PlatformCompaniesPage(): React.ReactElement {
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = usePlatformCompanies();
  const { hasPermission } = useUserPermissions();

  const canCreate = hasPermission(PERMISSIONS.PLATFORM_CREATE_COMPANY);

  /**
   * Handle edit company action.
   */
  function handleEditCompany(companyId: string): void {
    setEditCompanyId(companyId);
  }

  /**
   * Handle edit dialog close.
   */
  function handleEditClose(): void {
    setEditCompanyId(null);
  }

  /**
   * Handle company saved (created or updated).
   */
  function handleCompanySaved(): void {
    void refetch();
  }

  /**
   * Handle create success.
   */
  function handleCreateSuccess(): void {
    void refetch();
  }

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <Box>
          <Typography variant="h2" component="h1" gutterBottom>
            Companies
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage companies and their subscription settings.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => void refetch()} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {canCreate && (
            <Button
              variant="contained"
              startIcon={<AddBusinessIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Company
            </Button>
          )}
        </Box>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load companies. Please try again.
        </Alert>
      )}

      {/* Companies Table */}
      <CompanyTable
        companies={data?.companies ?? []}
        isLoading={isLoading}
        onEditCompany={handleEditCompany}
      />

      {/* Edit Dialog */}
      <CompanyEditDialog
        companyId={editCompanyId}
        open={editCompanyId !== null}
        onClose={handleEditClose}
        onSaved={handleCompanySaved}
      />

      {/* Create Dialog */}
      <CompanyCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </Box>
  );
}
