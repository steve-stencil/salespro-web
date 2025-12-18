/**
 * Internal User Edit Dialog Component
 *
 * Dialog for editing internal platform users including:
 * - Profile information (name, email)
 * - Account status (active/inactive)
 * - Platform role assignment
 * - Company access restrictions
 */
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useEffect } from 'react';

import {
  useInternalUser,
  usePlatformRoles,
  useUpdateInternalUser,
  useDeleteInternalUser,
} from '../../hooks/usePlatform';
import { handleApiError } from '../../lib/api-client';

import { InternalUserCompanyManager } from './InternalUserCompanyManager';

import type { SelectChangeEvent } from '@mui/material/Select';

type TabPanelProps = {
  children?: React.ReactNode;
  index: number;
  value: number;
};

/**
 * Tab panel wrapper component.
 */
function TabPanel({
  children,
  value,
  index,
}: TabPanelProps): React.ReactElement | null {
  if (value !== index) return null;
  return <Box sx={{ py: 2 }}>{children}</Box>;
}

type InternalUserEditDialogProps = {
  /** User ID to edit, or null if dialog is closed */
  userId: string | null;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when user is saved successfully */
  onSaved: () => void;
};

/**
 * Dialog for editing an internal platform user.
 */
export function InternalUserEditDialog({
  userId,
  open,
  onClose,
  onSaved,
}: InternalUserEditDialogProps): React.ReactElement {
  const [tabIndex, setTabIndex] = useState(0);
  const [nameFirst, setNameFirst] = useState('');
  const [nameLast, setNameLast] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    data: userData,
    isLoading: loadingUser,
    refetch: refetchUser,
  } = useInternalUser(userId ?? '', open && !!userId);

  const { data: rolesData, isLoading: loadingRoles } = usePlatformRoles();

  const updateUserMutation = useUpdateInternalUser();
  const deleteUserMutation = useDeleteInternalUser();

  const user = userData;

  // Initialize form values when user data loads
  useEffect(() => {
    if (user) {
      setNameFirst(user.nameFirst ?? '');
      setNameLast(user.nameLast ?? '');
      setEmail(user.email);
      setSelectedRoleId(user.platformRole?.id ?? '');
    }
  }, [user]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTabIndex(0);
      setError(null);
      setConfirmDelete(false);
    }
  }, [open]);

  /**
   * Handle tab change.
   */
  function handleTabChange(_: React.SyntheticEvent, newValue: number): void {
    setTabIndex(newValue);
  }

  /**
   * Handle role select change.
   */
  function handleRoleChange(event: SelectChangeEvent): void {
    setSelectedRoleId(event.target.value);
  }

  /**
   * Handle profile save.
   */
  async function handleSaveProfile(): Promise<void> {
    if (!userId) return;

    setError(null);
    try {
      await updateUserMutation.mutateAsync({
        userId,
        data: {
          nameFirst: nameFirst || undefined,
          nameLast: nameLast || undefined,
          platformRoleId: selectedRoleId || undefined,
        },
      });
      void refetchUser();
      onSaved();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle user activation toggle.
   */
  async function handleToggleActive(): Promise<void> {
    if (!userId || !user) return;

    setError(null);
    try {
      await updateUserMutation.mutateAsync({
        userId,
        data: { isActive: !user.isActive },
      });
      void refetchUser();
      onSaved();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle user deletion.
   */
  async function handleDelete(): Promise<void> {
    if (!userId) return;

    setError(null);
    try {
      await deleteUserMutation.mutateAsync(userId);
      onSaved();
      onClose();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  const isLoading =
    updateUserMutation.isPending || deleteUserMutation.isPending;

  const platformRoles = rolesData?.roles ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          {loadingUser
            ? 'Loading...'
            : user
              ? `Edit Internal User: ${user.nameFirst ?? user.email}`
              : 'Edit Internal User'}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label="Internal user edit tabs"
        >
          <Tab label="Profile" />
          <Tab label="Company Access" />
        </Tabs>
      </Box>

      <DialogContent>
        {loadingUser ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !user ? (
          <Alert severity="error">User not found</Alert>
        ) : (
          <>
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}

            {/* Profile Tab */}
            <TabPanel value={tabIndex} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Email"
                  value={email}
                  disabled
                  fullWidth
                  helperText="Email cannot be changed after creation"
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="First Name"
                    value={nameFirst}
                    onChange={e => setNameFirst(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Last Name"
                    value={nameLast}
                    onChange={e => setNameLast(e.target.value)}
                    fullWidth
                  />
                </Box>

                <FormControl fullWidth>
                  <InputLabel id="platform-role-label">
                    Platform Role
                  </InputLabel>
                  <Select
                    labelId="platform-role-label"
                    value={selectedRoleId}
                    label="Platform Role"
                    onChange={handleRoleChange}
                    disabled={loadingRoles || isLoading}
                  >
                    {platformRoles.map(role => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.displayName}
                        {role.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 1 }}
                          >
                            - {role.description}
                          </Typography>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Divider sx={{ my: 1 }} />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Account Status
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={user.isActive}
                        onChange={() => void handleToggleActive()}
                        disabled={isLoading}
                      />
                    }
                    label={user.isActive ? 'Active' : 'Inactive'}
                  />
                  {!user.isActive && (
                    <Typography variant="body2" color="error">
                      This user cannot log in while inactive.
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => void handleSaveProfile()}
                    disabled={isLoading}
                    startIcon={
                      updateUserMutation.isPending ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                  >
                    Save Changes
                  </Button>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Danger Zone */}
                <Box>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Danger Zone
                  </Typography>
                  {!confirmDelete ? (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setConfirmDelete(true)}
                      disabled={isLoading}
                    >
                      Delete User
                    </Button>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Are you sure?
                      </Typography>
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        onClick={() => void handleDelete()}
                        disabled={isLoading}
                        startIcon={
                          deleteUserMutation.isPending ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <DeleteIcon />
                          )
                        }
                      >
                        Confirm Delete
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setConfirmDelete(false)}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </TabPanel>

            {/* Company Access Tab */}
            <TabPanel value={tabIndex} index={1}>
              <InternalUserCompanyManager
                userId={user.id}
                userEmail={user.email}
                canEdit={true}
              />
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
