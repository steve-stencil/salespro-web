/**
 * Internal User Table Component
 *
 * Displays a table of internal platform users with their roles and status.
 * Supports row click to edit and displays key user information.
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
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

import type { InternalUserListItem } from '../../types/platform';

type InternalUserTableProps = {
  /** List of internal users to display */
  users: InternalUserListItem[];
  /** Whether the data is loading */
  isLoading: boolean;
  /** Callback when a user row is clicked for editing */
  onEditUser: (userId: string) => void;
};

/**
 * Formats a date string to a readable format.
 */
function formatDate(dateString?: string): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Gets the display name for a user.
 */
function getUserDisplayName(user: InternalUserListItem): string {
  if (user.nameFirst || user.nameLast) {
    return [user.nameFirst, user.nameLast].filter(Boolean).join(' ');
  }
  return user.email.split('@')[0] ?? user.email;
}

/**
 * Table component for displaying internal platform users.
 */
export function InternalUserTable({
  users,
  isLoading,
  onEditUser,
}: InternalUserTableProps): React.ReactElement {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (users.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No internal users found. Create one to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Platform Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last Login</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map(user => (
            <TableRow
              key={user.id}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => onEditUser(user.id)}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={500}>
                  {getUserDisplayName(user)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </TableCell>
              <TableCell>
                {user.platformRole ? (
                  <Chip
                    label={user.platformRole.displayName}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ) : (
                  <Typography variant="body2" color="text.disabled">
                    No role assigned
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {user.isActive ? (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Active"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Chip
                    icon={<RemoveCircleIcon />}
                    label="Inactive"
                    size="small"
                    color="default"
                    variant="outlined"
                  />
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(user.lastLoginDate)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(user.createdAt)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Edit user">
                  <IconButton
                    size="small"
                    onClick={e => {
                      e.stopPropagation();
                      onEditUser(user.id);
                    }}
                    aria-label={`Edit ${user.email}`}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
