/**
 * Dashboard page component.
 * Shows user info and quick actions.
 */

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HomeIcon from '@mui/icons-material/Home';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { useAuth } from '../hooks/useAuth';

export function DashboardPage(): React.ReactElement {
  const { user } = useAuth();

  return (
    <Box>
      {/* Welcome Card */}
      <Card sx={{ mb: 4, bgcolor: 'primary.light' }}>
        <CardContent
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            py: 4,
          }}
        >
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 64,
              height: 64,
            }}
          >
            <HomeIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography variant="h2" component="h1" gutterBottom>
              Welcome, {user?.nameFirst ?? 'User'}!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You&apos;re successfully logged in to your account.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h3" component="h2" gutterBottom>
                Account Details
              </Typography>

              <Box
                component="dl"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  m: 0,
                }}
              >
                <InfoItem label="Email" value={user?.email ?? 'N/A'} />
                <InfoItem
                  label="Name"
                  value={`${user?.nameFirst ?? ''} ${user?.nameLast ?? ''}`}
                />
                <InfoItem label="Company" value={user?.company.name ?? 'N/A'} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography
                    component="dt"
                    variant="body2"
                    color="text.secondary"
                  >
                    Email Verified
                  </Typography>
                  <Chip
                    size="small"
                    icon={
                      user?.emailVerified ? <CheckCircleIcon /> : <CancelIcon />
                    }
                    label={user?.emailVerified ? 'Verified' : 'Not Verified'}
                    color={user?.emailVerified ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography
                    component="dt"
                    variant="body2"
                    color="text.secondary"
                  >
                    MFA Status
                  </Typography>
                  <Chip
                    size="small"
                    icon={
                      user?.mfaEnabled ? <CheckCircleIcon /> : <CancelIcon />
                    }
                    label={user?.mfaEnabled ? 'Enabled' : 'Disabled'}
                    color={user?.mfaEnabled ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h3" component="h2" gutterBottom>
                Quick Actions
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Use the sidebar to navigate to Users and Roles management.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * Info item component for displaying label-value pairs.
 */
function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
