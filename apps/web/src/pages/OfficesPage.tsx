/**
 * Offices management page.
 * Lists all offices with create/edit/delete/settings capabilities.
 * Actions are conditionally rendered based on user permissions.
 */
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useState, useMemo } from 'react';

import {
  OfficeCard,
  OfficeDeleteDialog,
  OfficeEditDialog,
  OfficeFilters,
  OfficeSettingsDialog,
} from '../components/offices';
import { RequirePermission } from '../components/PermissionGuard';
import { useOfficesList, useDeleteOffice } from '../hooks/useOffices';
import { useOfficeSettings } from '../hooks/useOfficeSettings';
import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';
import { handleApiError } from '../lib/api-client';

import type {
  OfficeStatusFilter,
  OfficeSortOption,
} from '../components/offices';
import type { Office } from '../types/users';

/**
 * Office card skeleton for loading state.
 */
function OfficeCardSkeleton(): React.ReactElement {
  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
        <Skeleton variant="circular" width={48} height={48} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="rounded" width={60} height={24} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
      <Skeleton variant="text" width="30%" height={20} sx={{ mt: 2 }} />
    </Box>
  );
}

/**
 * Props for OfficeCardWithSettings.
 */
type OfficeCardWithSettingsProps = {
  office: Office;
  onEdit?: ((office: Office) => void) | undefined;
  onDelete?: ((office: Office) => void) | undefined;
  onSettings?: ((office: Office) => void) | undefined;
};

/**
 * Office card wrapper that fetches and displays settings (logo).
 */
function OfficeCardWithSettings({
  office,
  onEdit,
  onDelete,
  onSettings,
}: OfficeCardWithSettingsProps): React.ReactElement {
  const { data: settingsData, isLoading: isLoadingSettings } =
    useOfficeSettings(office.id);

  return (
    <OfficeCard
      office={office}
      logo={settingsData?.settings.logo}
      isLoadingSettings={isLoadingSettings}
      onEdit={onEdit}
      onDelete={onDelete}
      onSettings={onSettings}
    />
  );
}

/**
 * Filter and sort offices based on current filter state.
 */
function filterAndSortOffices(
  offices: Office[],
  searchQuery: string,
  statusFilter: OfficeStatusFilter,
  sortOption: OfficeSortOption,
): Office[] {
  let filtered = [...offices];

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(o => o.name.toLowerCase().includes(query));
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter(o => o.isActive === (statusFilter === 'active'));
  }

  filtered.sort((a, b) => {
    switch (sortOption) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'created-desc':
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'users':
        return (b.userCount ?? 0) - (a.userCount ?? 0);
      default:
        return 0;
    }
  });

  return filtered;
}

/**
 * Main offices management page component.
 */
export function OfficesPage(): React.ReactElement {
  const [editOffice, setEditOffice] = useState<Office | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteOffice, setDeleteOffice] = useState<Office | null>(null);
  const [settingsOffice, setSettingsOffice] = useState<Office | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OfficeStatusFilter>('all');
  const [sortOption, setSortOption] = useState<OfficeSortOption>('name-asc');

  const { data: officesData, isLoading, refetch } = useOfficesList();
  const deleteOfficeMutation = useDeleteOffice();
  const { hasPermission } = useUserPermissions();

  const canCreateOffice = hasPermission(PERMISSIONS.OFFICE_CREATE);
  const canUpdateOffice = hasPermission(PERMISSIONS.OFFICE_UPDATE);
  const canDeleteOffice = hasPermission(PERMISSIONS.OFFICE_DELETE);
  const canUpdateSettings = hasPermission(PERMISSIONS.SETTINGS_UPDATE);

  const filteredOffices = useMemo(
    () =>
      filterAndSortOffices(
        officesData?.offices ?? [],
        searchQuery,
        statusFilter,
        sortOption,
      ),
    [officesData?.offices, searchQuery, statusFilter, sortOption],
  );

  const filtersActive =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    sortOption !== 'name-asc';

  function handleClearFilters(): void {
    setSearchQuery('');
    setStatusFilter('all');
    setSortOption('name-asc');
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteOffice) return;
    setError(null);
    try {
      await deleteOfficeMutation.mutateAsync({
        officeId: deleteOffice.id,
        force: true,
      });
      setDeleteOffice(null);
      void refetch();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h2" component="h1" gutterBottom>
            Offices
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage offices for your company.
          </Typography>
        </Box>
        <RequirePermission permission={PERMISSIONS.OFFICE_CREATE}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateOpen(true)}
            data-testid="create-office-btn"
          >
            Create Office
          </Button>
        </RequirePermission>
      </Box>

      <OfficeFilters
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        sortOption={sortOption}
        hasActiveFilters={filtersActive}
        onSearchChange={setSearchQuery}
        onStatusChange={setStatusFilter}
        onSortChange={setSortOption}
        onClearFilters={handleClearFilters}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <OfficeCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {filteredOffices.length} office
            {filteredOffices.length !== 1 ? 's' : ''}
            {filtersActive && ' (filtered)'}
          </Typography>

          {filteredOffices.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              {filtersActive
                ? 'No offices match your filters.'
                : canCreateOffice
                  ? 'No offices created yet. Click "Create Office" to add one.'
                  : 'No offices have been created for your company yet.'}
              {filtersActive && (
                <Button
                  size="small"
                  onClick={handleClearFilters}
                  sx={{ ml: 1 }}
                >
                  Clear filters
                </Button>
              )}
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {filteredOffices.map(office => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={office.id}>
                  <OfficeCardWithSettings
                    office={office}
                    onEdit={canUpdateOffice ? setEditOffice : undefined}
                    onDelete={canDeleteOffice ? setDeleteOffice : undefined}
                    onSettings={
                      canUpdateSettings ? setSettingsOffice : undefined
                    }
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      <OfficeEditDialog
        open={isCreateOpen || editOffice !== null}
        office={editOffice}
        onClose={() => {
          setEditOffice(null);
          setIsCreateOpen(false);
        }}
        onSaved={() => void refetch()}
      />

      <OfficeDeleteDialog
        office={deleteOffice}
        isDeleting={deleteOfficeMutation.isPending}
        onClose={() => setDeleteOffice(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <OfficeSettingsDialog
        open={settingsOffice !== null}
        office={settingsOffice}
        onClose={() => setSettingsOffice(null)}
        onUpdated={() => void refetch()}
      />
    </Box>
  );
}
