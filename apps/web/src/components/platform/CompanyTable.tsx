/**
 * Company Table Component
 *
 * Displays a table of companies in the platform with key metrics.
 * Supports row click to edit and shows subscription tier, user count, etc.
 */
import BusinessIcon from '@mui/icons-material/Business';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
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

import type { PlatformCompany, SubscriptionTier } from '../../types/platform';

type CompanyTableProps = {
  /** List of companies to display */
  companies: PlatformCompany[];
  /** Whether the data is loading */
  isLoading: boolean;
  /** Callback when a company row is clicked for editing */
  onEditCompany: (companyId: string) => void;
};

/**
 * Formats a date string to a readable format.
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get tier display label and color.
 */
function getTierInfo(tier: SubscriptionTier): {
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'success';
} {
  switch (tier) {
    case 'free':
      return { label: 'Free', color: 'default' };
    case 'starter':
      return { label: 'Starter', color: 'primary' };
    case 'professional':
      return { label: 'Professional', color: 'secondary' };
    case 'enterprise':
      return { label: 'Enterprise', color: 'success' };
    default:
      return { label: tier, color: 'default' };
  }
}

/**
 * Table component for displaying platform companies.
 */
export function CompanyTable({
  companies,
  isLoading,
  onEditCompany,
}: CompanyTableProps): React.ReactElement {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (companies.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No companies found. Create one to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Company Name</TableCell>
            <TableCell>Tier</TableCell>
            <TableCell>Users</TableCell>
            <TableCell>Offices</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {companies.map(company => {
            const tierInfo = getTierInfo(company.subscriptionTier);
            return (
              <TableRow
                key={company.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onEditCompany(company.id)}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {company.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={tierInfo.label}
                    size="small"
                    color={tierInfo.color}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PeopleIcon fontSize="small" color="action" />
                    <Typography variant="body2">{company.userCount}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {company.officeCount}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {company.isActive ? (
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
                    {formatDate(company.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit company">
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        onEditCompany(company.id);
                      }}
                      aria-label={`Edit ${company.name}`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
