/**
 * Internal User Create Dialog Component
 *
 * Dialog for creating new internal platform users.
 * Collects email, password, name, and platform role.
 */
import CloseIcon from '@mui/icons-material/Close';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
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
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useEffect } from 'react';

import {
  usePlatformRoles,
  useCreateInternalUser,
} from '../../hooks/usePlatform';
import { handleApiError } from '../../lib/api-client';

import type { SelectChangeEvent } from '@mui/material/Select';

type InternalUserCreateDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when user is created successfully */
  onSuccess: () => void;
};

type FormErrors = {
  email?: string;
  password?: string;
  platformRoleId?: string;
};

/**
 * Validates email format.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Dialog for creating a new internal platform user.
 */
export function InternalUserCreateDialog({
  open,
  onClose,
  onSuccess,
}: InternalUserCreateDialogProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nameFirst, setNameFirst] = useState('');
  const [nameLast, setNameLast] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: rolesData, isLoading: loadingRoles } = usePlatformRoles();
  const createUserMutation = useCreateInternalUser();

  const platformRoles = rolesData?.roles ?? [];

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setNameFirst('');
      setNameLast('');
      setSelectedRoleId('');
      setErrors({});
      setSubmitError(null);
    }
  }, [open]);

  /**
   * Handle role select change.
   */
  function handleRoleChange(event: SelectChangeEvent): void {
    setSelectedRoleId(event.target.value);
    if (errors.platformRoleId) {
      setErrors(prev => ({ ...prev, platformRoleId: undefined }));
    }
  }

  /**
   * Validate form fields.
   */
  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!selectedRoleId) {
      newErrors.platformRoleId = 'Platform role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /**
   * Handle form submission.
   */
  async function handleSubmit(): Promise<void> {
    if (!validateForm()) return;

    setSubmitError(null);
    try {
      await createUserMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        nameFirst: nameFirst.trim() || undefined,
        nameLast: nameLast.trim() || undefined,
        platformRoleId: selectedRoleId,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(handleApiError(err));
    }
  }

  const isSubmitting = createUserMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>Create Internal User</Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create a new internal platform user. Internal users can access the
          platform administration features based on their assigned role.
        </Typography>

        {submitError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setSubmitError(null)}
          >
            {submitError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              if (errors.email)
                setErrors(prev => ({ ...prev, email: undefined }));
            }}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
            required
            autoFocus
            disabled={isSubmitting}
          />

          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              if (errors.password)
                setErrors(prev => ({ ...prev, password: undefined }));
            }}
            error={!!errors.password}
            helperText={errors.password ?? 'Minimum 8 characters'}
            fullWidth
            required
            disabled={isSubmitting}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="First Name"
              value={nameFirst}
              onChange={e => setNameFirst(e.target.value)}
              fullWidth
              disabled={isSubmitting}
            />
            <TextField
              label="Last Name"
              value={nameLast}
              onChange={e => setNameLast(e.target.value)}
              fullWidth
              disabled={isSubmitting}
            />
          </Box>

          <FormControl fullWidth error={!!errors.platformRoleId} required>
            <InputLabel id="create-platform-role-label">
              Platform Role
            </InputLabel>
            <Select
              labelId="create-platform-role-label"
              value={selectedRoleId}
              label="Platform Role"
              onChange={handleRoleChange}
              disabled={loadingRoles || isSubmitting}
            >
              {platformRoles.map(role => (
                <MenuItem key={role.id} value={role.id}>
                  <Box>
                    <Typography variant="body2">{role.displayName}</Typography>
                    {role.description && (
                      <Typography variant="caption" color="text.secondary">
                        {role.description}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.platformRoleId && (
              <FormHelperText>{errors.platformRoleId}</FormHelperText>
            )}
          </FormControl>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          Create User
        </Button>
      </DialogActions>
    </Dialog>
  );
}
