/**
 * Modal dialog for inviting new users to the company.
 * Allows selecting roles to assign to the invited user.
 */
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
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
import { useState, useEffect } from 'react';

import { useRolesList } from '../../hooks/useRoles';
import { useSendInvite } from '../../hooks/useUsers';
import { handleApiError } from '../../lib/api-client';

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
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const { data: rolesData, isLoading: loadingRoles } = useRolesList();
  const sendInviteMutation = useSendInvite();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail('');
      setSelectedRoles([]);
      setError(null);
      setEmailError(null);
    }
  }, [open]);

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

    setError(null);
    setEmailError(null);

    try {
      await sendInviteMutation.mutateAsync({
        email: email.trim(),
        roles: selectedRoles,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(handleApiError(err));
    }
  }

  const isLoading = sendInviteMutation.isPending;
  const roles = rolesData?.roles ?? [];

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
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {role.description}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            )}
            {selectedRoles.length === 0 && !loadingRoles && roles.length > 0 && (
              <FormHelperText>Select at least one role</FormHelperText>
            )}
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={
            isLoading ||
            !email.trim() ||
            !!emailError ||
            selectedRoles.length === 0
          }
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
