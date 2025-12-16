/**
 * Office access management component.
 * Allows managing which offices a user can access and setting their current office.
 */
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { useOfficesList } from '../../hooks/useOffices';
import {
  useAddOfficeAccess,
  useRemoveOfficeAccess,
  useSetCurrentOffice,
} from '../../hooks/useUsers';
import { handleApiError } from '../../lib/api-client';

import type { UserDetail, Office } from '../../types/users';
import type { SelectChangeEvent } from '@mui/material/Select';

interface OfficeAccessManagerProps {
  user: UserDetail;
  onUpdate: () => void;
}

/**
 * Component for managing user office access.
 * Shows allowed offices, allows adding/removing access, and setting current office.
 */
export function OfficeAccessManager({
  user,
  onUpdate,
}: OfficeAccessManagerProps): React.ReactElement {
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: officesData, isLoading: loadingOffices } = useOfficesList(true);
  const addOfficeMutation = useAddOfficeAccess();
  const removeOfficeMutation = useRemoveOfficeAccess();
  const setCurrentOfficeMutation = useSetCurrentOffice();

  // Get offices the user doesn't have access to yet
  const allowedOfficeIds = new Set(user.allowedOffices.map(o => o.id));
  const availableOffices =
    officesData?.offices.filter(o => !allowedOfficeIds.has(o.id)) ?? [];

  /**
   * Handle adding office access.
   */
  async function handleAddOffice(): Promise<void> {
    if (!selectedOffice) return;

    setError(null);
    try {
      await addOfficeMutation.mutateAsync({
        userId: user.id,
        officeId: selectedOffice.id,
      });
      setSelectedOffice(null);
      onUpdate();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle removing office access.
   */
  async function handleRemoveOffice(officeId: string): Promise<void> {
    setError(null);
    try {
      await removeOfficeMutation.mutateAsync({
        userId: user.id,
        officeId,
      });
      onUpdate();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle setting current office.
   */
  async function handleSetCurrentOffice(
    event: SelectChangeEvent,
  ): Promise<void> {
    const value = event.target.value;
    setError(null);
    try {
      await setCurrentOfficeMutation.mutateAsync({
        userId: user.id,
        officeId: value || null,
      });
      onUpdate();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  const isLoading =
    addOfficeMutation.isPending ||
    removeOfficeMutation.isPending ||
    setCurrentOfficeMutation.isPending;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Current Office Selector */}
      <Typography variant="subtitle2" gutterBottom>
        Current Office
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        The office that determines which data the user sees in the mobile app.
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 3 }}>
        <InputLabel id="current-office-label">Current Office</InputLabel>
        <Select
          labelId="current-office-label"
          value={user.currentOffice?.id ?? ''}
          label="Current Office"
          onChange={e => void handleSetCurrentOffice(e)}
          disabled={isLoading || user.allowedOffices.length === 0}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {user.allowedOffices.map(office => (
            <MenuItem key={office.id} value={office.id}>
              {office.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider sx={{ my: 2 }} />

      {/* Allowed Offices List */}
      <Typography variant="subtitle2" gutterBottom>
        Allowed Offices ({user.allowedOffices.length})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Offices the user can switch to in the mobile app.
      </Typography>

      {user.allowedOffices.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No offices assigned. Add office access below.
        </Alert>
      ) : (
        <List dense sx={{ mb: 2 }}>
          {user.allowedOffices.map(office => {
            const isCurrent = user.currentOffice?.id === office.id;

            return (
              <ListItem
                key={office.id}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: isCurrent ? 'action.selected' : 'transparent',
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {isCurrent ? (
                    <StarIcon color="primary" />
                  ) : (
                    <BusinessIcon color="action" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {office.name}
                      {isCurrent && (
                        <Chip
                          label="Current"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={`Added ${new Date(office.assignedAt).toLocaleDateString()}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label={`Remove ${office.name} access`}
                    onClick={() => void handleRemoveOffice(office.id)}
                    disabled={isLoading}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Add Office Access */}
      <Typography variant="subtitle2" gutterBottom>
        Add Office Access
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Autocomplete
          value={selectedOffice}
          onChange={(_, newValue) => setSelectedOffice(newValue)}
          options={availableOffices}
          getOptionLabel={option => option.name}
          loading={loadingOffices}
          disabled={isLoading || availableOffices.length === 0}
          sx={{ flex: 1 }}
          renderInput={params => (
            <TextField
              {...params}
              label="Select Office"
              size="small"
              placeholder={
                availableOffices.length === 0
                  ? 'No more offices available'
                  : 'Search offices...'
              }
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingOffices ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
        <Button
          variant="contained"
          onClick={() => void handleAddOffice()}
          disabled={!selectedOffice || isLoading}
          startIcon={
            addOfficeMutation.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AddIcon />
            )
          }
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}
