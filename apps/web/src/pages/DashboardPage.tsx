/**
 * Dashboard page component.
 * Protected placeholder showing user info and logout functionality.
 */

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

export function DashboardPage(): React.ReactElement {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Handles logout action.
   */
  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
      void navigate('/login', { replace: true });
    } catch {
      // Error handled in context, still redirect
      void navigate('/login', { replace: true });
    }
  }

  /**
   * Logout button click handler wrapper for void return.
   */
  function onLogoutClick(): void {
    void handleLogout();
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography
            variant="h2"
            component="h1"
            sx={{ flexGrow: 1, color: 'text.primary' }}
          >
            SalesPro Dashboard
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                {user?.nameFirst.charAt(0) ?? 'U'}
              </Avatar>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {user?.nameFirst} {user?.nameLast}
              </Typography>
            </Box>

            <Button
              variant="outlined"
              color="inherit"
              onClick={onLogoutClick}
              disabled={isLoggingOut}
              startIcon={
                isLoggingOut ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <LogoutIcon />
                )
              }
            >
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
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
              <Typography variant="h2" component="h2" gutterBottom>
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
                <Typography variant="h3" component="h3" gutterBottom>
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
                  <InfoItem
                    label="Company"
                    value={user?.company.name ?? 'N/A'}
                  />
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
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
                        user?.emailVerified ? (
                          <CheckCircleIcon />
                        ) : (
                          <CancelIcon />
                        )
                      }
                      label={user?.emailVerified ? 'Verified' : 'Not Verified'}
                      color={user?.emailVerified ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
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
                <Typography variant="h3" component="h3" gutterBottom>
                  Quick Actions
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  This is a placeholder dashboard. Additional features and
                  content will be added here.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
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
