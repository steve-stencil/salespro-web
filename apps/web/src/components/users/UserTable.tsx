/**
 * User data table component.
 * Displays a paginated list of users with status badges and actions.
 */
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import type { UserListItem, Pagination } from '../../types/users';

type UserTableProps = {
  users: UserListItem[];
  pagination: Pagination;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onEditUser: (userId: string) => void;
};

/**
 * Data table for displaying users.
 */
export function UserTable({
  users,
  pagination,
  isLoading,
  onPageChange,
  onRowsPerPageChange,
  onEditUser,
}: UserTableProps): React.ReactElement {
  /**
   * Handle page change.
   */
  function handlePageChange(
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ): void {
    onPageChange(newPage + 1); // MUI is 0-indexed, API is 1-indexed
  }

  /**
   * Handle rows per page change.
   */
  function handleRowsPerPageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): void {
    onRowsPerPageChange(parseInt(event.target.value, 10));
    onPageChange(1); // Reset to first page
  }

  /**
   * Render loading skeleton rows.
   */
  function renderSkeletons(): React.ReactElement[] {
    return Array.from({ length: pagination.limit }, (_, i) => (
      <TableRow key={i}>
        <TableCell>
          <Skeleton variant="text" width={200} />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width={150} />
        </TableCell>
        <TableCell>
          <Skeleton variant="rounded" width={60} height={24} />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width={120} />
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Skeleton variant="rounded" width={60} height={24} />
          </Box>
        </TableCell>
        <TableCell>
          <Skeleton variant="circular" width={32} height={32} />
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer>
        <Table sx={{ minWidth: 800 }} aria-label="Users table">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Current Office</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              renderSkeletons()
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No users found matching your filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {user.nameFirst || user.nameLast
                          ? `${user.nameFirst ?? ''} ${user.nameLast ?? ''}`.trim()
                          : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.currentOffice ? (
                      <Typography variant="body2">
                        {user.currentOffice.name}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        None
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isActive ? 'Active' : 'Inactive'}
                      color={user.isActive ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {user.lastLoginDate ? (
                      <Typography variant="body2">
                        {new Date(user.lastLoginDate).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Never
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {user.roles.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      ) : (
                        user.roles
                          .slice(0, 2)
                          .map(role => (
                            <Chip
                              key={role.id}
                              label={role.displayName}
                              size="small"
                              variant="outlined"
                            />
                          ))
                      )}
                      {user.roles.length > 2 && (
                        <Chip
                          label={`+${user.roles.length - 2}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => onEditUser(user.id)}
                      aria-label={`Edit ${user.nameFirst ?? user.email}`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={pagination.total}
        page={pagination.page - 1} // MUI is 0-indexed
        rowsPerPage={pagination.limit}
        rowsPerPageOptions={[10, 20, 50]}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
    </Paper>
  );
}
