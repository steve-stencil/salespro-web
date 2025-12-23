/**
 * Import Templates Wizard Component
 *
 * Multi-step wizard for importing document templates from Parse.
 */

import {
  Box,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';

import { useImportBatches, useSourceDocumentCount } from '../hooks';

import { ImportProgressStep } from './ImportProgressStep';
import { OfficeMappingStep } from './OfficeMappingStep';
import { TypeMappingStep } from './TypeMappingStep';

import type { OfficeMapping, TypeMapping } from '../types';
import type { FC } from 'react';

const STEPS = ['Map Offices', 'Map Types', 'Import'];

type ImportTemplatesWizardProps = {
  readonly onComplete: () => void;
  readonly onCancel: () => void;
};

/**
 * Import Templates Wizard Component.
 */
export const ImportTemplatesWizard: FC<ImportTemplatesWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [officeMapping, setOfficeMapping] = useState<OfficeMapping>({});
  const [typeMapping, setTypeMapping] = useState<TypeMapping>({});

  const { data: documentCount } = useSourceDocumentCount();

  const {
    isImporting,
    progress,
    importedCount,
    skippedCount,
    errorCount,
    totalCount,
    errors,
    isComplete,
    startImport,
    reset,
  } = useImportBatches();

  const handleNextFromOffices = useCallback(() => {
    setActiveStep(1);
  }, []);

  const handleNextFromTypes = useCallback(async () => {
    setActiveStep(2);
    // Start the import
    await startImport(officeMapping, typeMapping);
  }, [officeMapping, typeMapping, startImport]);

  const handleBack = useCallback(() => {
    setActiveStep(prev => prev - 1);
  }, []);

  const handleRetry = useCallback(() => {
    reset();
    setActiveStep(0);
  }, [reset]);

  return (
    <Box>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Import Document Templates
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Import templates from your legacy system. Found{' '}
          <strong>{documentCount ?? '...'}</strong> documents to import.
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEPS.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        {activeStep === 0 && (
          <OfficeMappingStep
            officeMapping={officeMapping}
            onMappingChange={setOfficeMapping}
            onNext={handleNextFromOffices}
            onCancel={onCancel}
          />
        )}

        {activeStep === 1 && (
          <TypeMappingStep
            typeMapping={typeMapping}
            onMappingChange={setTypeMapping}
            onNext={() => void handleNextFromTypes()}
            onBack={handleBack}
          />
        )}

        {activeStep === 2 && (
          <ImportProgressStep
            isImporting={isImporting}
            progress={progress}
            importedCount={importedCount}
            skippedCount={skippedCount}
            errorCount={errorCount}
            totalCount={totalCount}
            errors={errors}
            isComplete={isComplete}
            onDone={() => void onComplete()}
            onRetry={handleRetry}
          />
        )}
      </Paper>
    </Box>
  );
};
