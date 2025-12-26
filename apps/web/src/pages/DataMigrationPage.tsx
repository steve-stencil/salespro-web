/**
 * Data Migration Page
 *
 * Page for managing data migrations from legacy Parse system.
 */

import { Container } from '@mui/material';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { OfficeMigrationWizard } from '../features/migration';

import type { FC } from 'react';

/**
 * Data Migration Page Component.
 */
const DataMigrationPage: FC = () => {
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    void navigate('/offices');
  }, [navigate]);

  const handleCancel = useCallback(() => {
    void navigate(-1);
  }, [navigate]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <OfficeMigrationWizard
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </Container>
  );
};

export default DataMigrationPage;
