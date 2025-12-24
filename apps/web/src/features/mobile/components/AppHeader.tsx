/**
 * Mobile App Header component.
 * Provides navigation back to the main web app.
 */
import ComputerIcon from '@mui/icons-material/Computer';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type React from 'react';

/**
 * Header component for the mobile app.
 * Displays app title and toggle button to switch back to web app.
 */
export function AppHeader(): React.ReactElement {
  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Toolbar>
        {/* App Title */}
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          SalesPro Mobile
        </Typography>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Web App Toggle */}
        <Tooltip title="Switch to Web App">
          <Button
            variant="outlined"
            color="primary"
            size="small"
            href="http://localhost:5173"
            startIcon={<ComputerIcon />}
          >
            Web App
          </Button>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
