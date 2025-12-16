/**
 * Modal dialog for inviting new users to the company.
 * Allows selecting roles and offices to assign to the invited user.
 */
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useEffect, useMemo } from 'react';

import { useOfficesList } from '../../hooks/useOffices';
import { useRolesList } from '../../hooks/useRoles';
import { useSendInvite } from '../../hooks/useUsers';
import { handleApiError } from '../../lib/api-client';

import type { Office } from '../../types/users';

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal for inviting new users to the company.
 */
export function InviteUserModal({
  open,
  onClose,
  onSuccess,
}: InviteUserModalProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedAllowedOffices, setSelectedAllowedOffices] = useState<
    string[]
  >([]);
  const [selectedCurrentOffice, setSelectedCurrentOffice] =
    useState<Office | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const { data: rolesData, isLoading: loadingRoles } = useRolesList();
  const { data: officesData, isLoading: loadingOffices } = useOfficesList({
    isActive: true,
  });
  const sendInviteMutation = useSendInvite();

  // Memoize offices to avoid reference changes
  const offices = useMemo(
    () => officesData?.offices ?? [],
    [officesData?.offices],
  );

  // Filter current office options to only show selected allowed offices
  const currentOfficeOptions = useMemo(
    () => offices.filter(office => selectedAllowedOffices.includes(office.id)),
    [offices, selectedAllowedOffices],
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail('');
      setSelectedRoles([]);
      setSelectedAllowedOffices([]);
      setSelectedCurrentOffice(null);
      setError(null);
      setEmailError(null);
    }
  }, [open]);

  // Clear current office if it's no longer in allowed offices
  useEffect(() => {
    if (
      selectedCurrentOffice &&
      !selectedAllowedOffices.includes(selectedCurrentOffice.id)
    ) {
      setSelectedCurrentOffice(null);
    }
  }, [selectedAllowedOffices, selectedCurrentOffice]);

  /**
   * Validate email format.
   */
  function validateEmail(emailValue: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  }

  /**
   * Handle email input change.
   */
  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value;
    setEmail(value);

    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError(null);
    }
  }

  /**
   * Handle role checkbox toggle.
   */
  function handleRoleToggle(roleId: string): void {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId],
    );
  }

  /**
   * Handle allowed office checkbox toggle.
   */
  function handleOfficeToggle(officeId: string): void {
    setSelectedAllowedOffices(prev =>
      prev.includes(officeId)
        ? prev.filter(id => id !== officeId)
        : [...prev, officeId],
    );
  }

  /**
   * Handle form submission.
   */
  async function handleSubmit(): Promise<void> {
    // Validate email
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Validate at least one role
    if (selectedRoles.length === 0) {
      setError('Please select at least one role');
      return;
    }

    // Validate at least one allowed office
    if (selectedAllowedOffices.length === 0) {
      setError('Please select at least one allowed office');
      return;
    }

    // Validate current office is selected
    if (!selectedCurrentOffice) {
      setError('Please select a current office');
      return;
    }

    setError(null);
    setEmailError(null);

    try {
      await sendInviteMutation.mutateAsync({
        email: email.trim(),
        roles: selectedRoles,
        currentOfficeId: selectedCurrentOffice.id,
        allowedOfficeIds: selectedAllowedOffices,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  const isLoading = sendInviteMutation.isPending;
  const roles = rolesData?.roles ?? [];

  /**
   * Check if form is valid for submission.
   */
  const isFormValid =
    email.trim() &&
    !emailError &&
    selectedRoles.length > 0 &&
    selectedAllowedOffices.length > 0 &&
    selectedCurrentOffice !== null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>Invite User</Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Send an invitation email to a new user. They will receive a link to
          create their account and join your company.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={handleEmailChange}
            error={!!emailError}
            helperText={emailError}
            fullWidth
            required
            placeholder="user@example.com"
            disabled={isLoading}
            autoFocus
          />

          <FormControl component="fieldset" error={selectedRoles.length === 0}>
            <FormLabel component="legend">
              Roles to Assign
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                (select at least one)
              </Typography>
            </FormLabel>
            {loadingRoles ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : roles.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                No roles available. Please create roles first.
              </Alert>
            ) : (
              <FormGroup sx={{ mt: 1 }}>
                {roles.map(role => (
                  <FormControlLabel
                    key={role.id}
                    control={
                      <Checkbox
                        checked={selectedRoles.includes(role.id)}
                        onChange={() => handleRoleToggle(role.id)}
                        disabled={isLoading}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {role.displayName}
                        </Typography>
                        {role.description && (
                          <Typography variant="caption" color="text.secondary">
                            {role.description}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            )}
            {selectedRoles.length === 0 &&
              !loadingRoles &&
              roles.length > 0 && (
                <FormHelperText>Select at least one role</FormHelperText>
              )}
          </FormControl>

          <FormControl
            component="fieldset"
            error={selectedAllowedOffices.length === 0}
          >
            <FormLabel component="legend">
              Allowed Offices
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                (select at least one)
              </Typography>
            </FormLabel>
            {loadingOffices ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : offices.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                No offices available. Please create offices first.
              </Alert>
            ) : (
              <FormGroup sx={{ mt: 1 }}>
                {offices.map(office => (
                  <FormControlLabel
                    key={office.id}
                    control={
                      <Checkbox
                        checked={selectedAllowedOffices.includes(office.id)}
                        onChange={() => handleOfficeToggle(office.id)}
                        disabled={isLoading}
                      />
                    }
                    label={
                      <Typography variant="body2">{office.name}</Typography>
                    }
                  />
                ))}
              </FormGroup>
            )}
            {selectedAllowedOffices.length === 0 &&
              !loadingOffices &&
              offices.length > 0 && (
                <FormHelperText>Select at least one office</FormHelperText>
              )}
          </FormControl>

          <Autocomplete
            options={currentOfficeOptions}
            value={selectedCurrentOffice}
            onChange={(_, newValue) => setSelectedCurrentOffice(newValue)}
            getOptionLabel={option => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            disabled={isLoading || selectedAllowedOffices.length === 0}
            renderInput={params => (
              <TextField
                {...params}
                label="Current Office"
                required
                error={
                  selectedAllowedOffices.length > 0 && !selectedCurrentOffice
                }
                helperText={
                  selectedAllowedOffices.length === 0
                    ? 'Select allowed offices first'
                    : !selectedCurrentOffice
                      ? 'Select the office the user will work in'
                      : ''
                }
              />
            )}
            noOptionsText="Select allowed offices first"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isLoading || !isFormValid}
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <SendIcon />
            )
          }
        >
          Send Invitation
        </Button>
      </DialogActions>
    </Dialog>
  );
}
