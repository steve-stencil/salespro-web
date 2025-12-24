/**
 * Mobile Contract Preview Page.
 * Wraps the mobile contract preview component within the web app context.
 */
import Box from '@mui/material/Box';

import {
  ContractPreviewPage,
  FeatureFlagProvider,
  OfflineProvider,
} from '../features/mobile';

import type React from 'react';

/**
 * Wrapper page for the mobile contract preview experience.
 * Provides necessary context providers from the mobile app.
 */
export function MobileContractPage(): React.ReactElement {
  return (
    <FeatureFlagProvider>
      <OfflineProvider>
        <Box sx={{ height: '100%', minHeight: 'calc(100vh - 64px)' }}>
          <ContractPreviewPage />
        </Box>
      </OfflineProvider>
    </FeatureFlagProvider>
  );
}
