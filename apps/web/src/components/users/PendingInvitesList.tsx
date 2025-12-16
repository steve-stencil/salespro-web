/**
 * Pending invites list component.
 * Shows all pending user invitations with actions to resend or revoke.
 */
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import {
  useInvitesList,
  useResendInvite,
  useRevokeInvite,
} from '../../hooks/useUsers';
import { handleApiError } from '../../lib/api-client';

import type { InviteListItem } from '../../types/users';

type PendingInvitesListProps = {
  onInviteChange: () => void;
};

/**
 * Format a date for display.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Check if an invite is about to expire (within 24 hours).
 */
function isExpiringSoon(expiresAt: string): boolean {
  const expires = new Date(expiresAt);
  const now = new Date();
  const hoursUntilExpiry =
    (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
}

/**
 * Get inviter display name.
 */
function getInviterName(invite: InviteListItem): string {
  const { invitedBy } = invite;
  if (invitedBy.nameFirst || invitedBy.nameLast) {
    return `${invitedBy.nameFirst ?? ''} ${invitedBy.nameLast ?? ''}`.trim();
  }
  return invitedBy.email;
}

/**
 * Component for displaying and managing pending user invitations.
 */
export function PendingInvitesList({
  onInviteChange,
}: PendingInvitesListProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const { data, isLoading, refetch } = useInvitesList();
  const resendMutation = useResendInvite();
  const revokeMutation = useRevokeInvite();

  const invites = data?.invites ?? [];

  /**
   * Handle resend invite action.
   */
  async function handleResend(inviteId: string): Promise<void> {
    setError(null);
    setActionInProgress(inviteId);

    try {
      await resendMutation.mutateAsync(inviteId);
      void refetch();
      onInviteChange();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionInProgress(null);
    }
  }

  /**
   * Handle revoke invite action.
   */
  async function handleRevoke(inviteId: string): Promise<void> {
    setError(null);
    setActionInProgress(inviteId);

    try {
      await revokeMutation.mutateAsync(inviteId);
      void refetch();
      onInviteChange();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionInProgress(null);
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (invites.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No pending invitations.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Use the &quot;Invite User&quot; button to invite new users to your
          company.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Invited By</TableCell>
              <TableCell>Sent</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invites.map(invite => {
              const isProcessing = actionInProgress === invite.id;
              const expiringSoon = isExpiringSoon(invite.expiresAt);

              return (
                <TableRow key={invite.id}>
                  <TableCell>
                    <Typography variant="body2">{invite.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getInviterName(invite)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(invite.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {formatDate(invite.expiresAt)}
                      </Typography>
                      {expiringSoon && (
                        <Chip
                          label="Expiring soon"
                          color="warning"
                          size="small"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 0.5,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Tooltip title="Resend invitation">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => void handleResend(invite.id)}
                            disabled={isProcessing}
                            color="primary"
                          >
                            {isProcessing && resendMutation.isPending ? (
                              <CircularProgress size={18} />
                            ) : (
                              <RefreshIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Revoke invitation">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => void handleRevoke(invite.id)}
                            disabled={isProcessing}
                            color="error"
                          >
                            {isProcessing && revokeMutation.isPending ? (
                              <CircularProgress size={18} />
                            ) : (
                              <CancelIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {invites.length} of {data.pagination.total} invites
          </Typography>
        </Box>
      )}
    </Box>
  );
}
