/**
 * User edit dialog component.
 * Provides tabs for editing user profile, roles, and office access.
 */
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useEffect } from 'react';

import {
  useRolesList,
  useAssignRole,
  useRevokeRole,
} from '../../hooks/useRoles';
import { useUser, useUpdateUser, useSetUserActive } from '../../hooks/useUsers';
import { handleApiError } from '../../lib/api-client';

import { OfficeAccessManager } from './OfficeAccessManager';

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

type UserEditDialogProps = {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Dialog for editing user details, roles, and office access.
 */
export function UserEditDialog({
  userId,
  open,
  onClose,
  onSaved,
}: UserEditDialogProps): React.ReactElement {
  const [tabIndex, setTabIndex] = useState(0);
  const [nameFirst, setNameFirst] = useState('');
  const [nameLast, setNameLast] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const {
    data: userData,
    isLoading: loadingUser,
    refetch: refetchUser,
  } = useUser(userId ?? '');
  const { data: rolesData } = useRolesList();
  const updateUserMutation = useUpdateUser();
  const setActiveMutation = useSetUserActive();
  const assignRoleMutation = useAssignRole();
  const revokeRoleMutation = useRevokeRole();

  const user = userData?.user;

  // Initialize form values when user data loads
  useEffect(() => {
    if (user) {
      setNameFirst(user.nameFirst ?? '');
      setNameLast(user.nameLast ?? '');
    }
  }, [user]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTabIndex(0);
      setError(null);
      setSelectedRoleId('');
    }
  }, [open]);

  /**
   * Handle tab change.
   */
  function handleTabChange(_: React.SyntheticEvent, newValue: number): void {
    setTabIndex(newValue);
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
        data: { nameFirst, nameLast },
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
      await setActiveMutation.mutateAsync({
        userId,
        isActive: !user.isActive,
      });
      void refetchUser();
      onSaved();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle role assignment.
   */
  async function handleAssignRole(): Promise<void> {
    if (!userId || !selectedRoleId) return;

    setError(null);
    try {
      await assignRoleMutation.mutateAsync({
        userId,
        roleId: selectedRoleId,
      });
      setSelectedRoleId('');
      void refetchUser();
      onSaved();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle role revocation.
   */
  async function handleRevokeRole(roleId: string): Promise<void> {
    if (!userId) return;

    setError(null);
    try {
      await revokeRoleMutation.mutateAsync({ userId, roleId });
      void refetchUser();
      onSaved();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  /**
   * Handle role select change.
   */
  function handleRoleSelectChange(event: SelectChangeEvent): void {
    setSelectedRoleId(event.target.value);
  }

  // Get roles not yet assigned to user
  const userRoleIds = new Set(user?.roles.map(r => r.id) ?? []);
  const availableRoles =
    rolesData?.roles.filter(r => !userRoleIds.has(r.id)) ?? [];

  const isLoading =
    updateUserMutation.isPending ||
    setActiveMutation.isPending ||
    assignRoleMutation.isPending ||
    revokeRoleMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          {loadingUser
            ? 'Loading...'
            : user
              ? `Edit User: ${user.nameFirst ?? user.email}`
              : 'Edit User'}
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
          aria-label="User edit tabs"
        >
          <Tab label="Profile" />
          <Tab label="Roles" />
          <Tab label="Office Access" />
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
                  value={user.email}
                  disabled
                  fullWidth
                  helperText="Email cannot be changed"
                />

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

                <Divider sx={{ my: 1 }} />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Account Info
                  </Typography>
                  <Box
                    sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}
                  >
                    <Chip
                      label={
                        user.emailVerified
                          ? 'Email Verified'
                          : 'Email Not Verified'
                      }
                      color={user.emailVerified ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={user.mfaEnabled ? 'MFA Enabled' : 'MFA Disabled'}
                      color={user.mfaEnabled ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                    {user.needsResetPassword && (
                      <Chip
                        label="Password Reset Required"
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
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
                    Save Profile
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            {/* Roles Tab */}
            <TabPanel value={tabIndex} index={1}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Assigned Roles ({user.roles.length})
                </Typography>

                {user.roles.length === 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No roles assigned to this user.
                  </Alert>
                ) : (
                  <List dense sx={{ mb: 2 }}>
                    {user.roles.map(role => (
                      <ListItem
                        key={role.id}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            aria-label={`Remove ${role.displayName} role`}
                            onClick={() => void handleRevokeRole(role.id)}
                            disabled={isLoading}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={role.displayName}
                          secondary={role.name}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Assign Role
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel id="role-select-label">Select Role</InputLabel>
                    <Select
                      labelId="role-select-label"
                      value={selectedRoleId}
                      label="Select Role"
                      onChange={handleRoleSelectChange}
                      disabled={isLoading || availableRoles.length === 0}
                    >
                      {availableRoles.map(role => (
                        <MenuItem key={role.id} value={role.id}>
                          {role.displayName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    onClick={() => void handleAssignRole()}
                    disabled={!selectedRoleId || isLoading}
                    startIcon={
                      assignRoleMutation.isPending ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <AddIcon />
                      )
                    }
                  >
                    Assign
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            {/* Office Access Tab */}
            <TabPanel value={tabIndex} index={2}>
              <OfficeAccessManager
                user={user}
                onUpdate={() => {
                  void refetchUser();
                  onSaved();
                }}
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
