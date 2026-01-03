/**
 * Price Guide Migration Wizard Page.
 * Guides users through migrating legacy price guide data.
 */

import Box from '@mui/material/Box';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { PriceGuideMigrationWizard } from '../../features/migration';

/**
 * Page wrapper for the Price Guide Migration Wizard.
 * Handles navigation on completion/cancel.
 */
export function MigrationWizardPage(): React.ReactElement {
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    // Navigate to the price guide catalog after successful import
    void navigate('/dashboard/price-guide');
  }, [navigate]);

  const handleCancel = useCallback(() => {
    // Navigate back to tools page on cancel
    void navigate('/dashboard/price-guide/tools');
  }, [navigate]);

  return (
    <Box>
      <PriceGuideMigrationWizard
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </Box>
  );
}
