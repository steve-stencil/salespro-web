/**
 * Import Templates Page
 *
 * Page for importing document templates from legacy Parse system.
 */

import { Container } from '@mui/material';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { ImportTemplatesWizard } from '../features/etl';

import type { FC } from 'react';

/**
 * Import Templates Page Component.
 */
const ImportTemplatesPage: FC = () => {
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    void navigate('/document-templates');
  }, [navigate]);

  const handleCancel = useCallback(() => {
    void navigate(-1);
  }, [navigate]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <ImportTemplatesWizard
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </Container>
  );
};

export default ImportTemplatesPage;
