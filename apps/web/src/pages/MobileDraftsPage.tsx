/**
 * Mobile Drafts Page.
 * Displays a list of draft contracts for the mobile app.
 */
import DraftsIcon from '@mui/icons-material/Drafts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type React from 'react';

/**
 * Placeholder page for mobile drafts functionality.
 * Will be implemented to show draft contracts.
 */
export function MobileDraftsPage(): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <DraftsIcon
        sx={{
          fontSize: 80,
          color: 'text.secondary',
          mb: 2,
          opacity: 0.5,
        }}
      />
      <Typography variant="h4" gutterBottom>
        Drafts
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
        View and manage your contract drafts here. This feature is coming soon.
      </Typography>
    </Box>
  );
}
