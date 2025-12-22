/**
 * Contract Preview Page - Main page for contract workflow.
 * Implements iOS parity for contract template selection, preview, signing, and sending.
 * Based on iOS: ContractObjectSelectionCollectionViewController.m
 */
import { Box, Alert } from '@mui/material';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { DocumentActionBar } from '../components/DocumentActionBar';
import { DocumentTemplateGrid } from '../components/DocumentTemplateGrid';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { useOffline } from '../context/OfflineContext';
import { useDocumentTemplates } from '../hooks/useDocumentTemplates';

import type React from 'react';

/**
 * Main contract preview page component.
 * Shows the template selection grid (iOS parity).
 */
export function ContractPreviewPage(): React.ReactElement {
  const { estimateId: _ } = useParams<{ estimateId: string }>();
  void _; // Reserved for future use
  const { status: offlineStatus } = useOffline();
  const { isReady: flagsReady } = useFeatureFlags();

  // Document templates using new hook
  // TODO: Get state and officeId from customer/estimate context
  const {
    templates,
    categories,
    isLoading,
    error,
    selections,
    selectedCount,
    toggleTemplate,
    setTemplatePageCount,
    toggleCategoryCollapse,
    refetch,
  } = useDocumentTemplates({
    enabled: true,
  });

  /**
   * Handle NEXT button click.
   */
  const handleNext = useCallback((): void => {
    // TODO: Navigate to preview/form step
    console.log(
      'NEXT clicked - selected templates:',
      Array.from(selections.entries()),
    );
  }, [selections]);

  /**
   * Handle retry after error.
   */
  const handleRetry = useCallback((): void => {
    refetch();
  }, [refetch]);

  // Offline indicator
  const offlineIndicator = !offlineStatus.isOnline && (
    <Alert severity="warning" sx={{ mb: 2 }}>
      You are offline. Some features may be limited.
    </Alert>
  );

  // Can proceed if at least one template is selected
  const canProceed = selectedCount > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 'calc(100vh - 64px)',
        bgcolor: 'background.default',
      }}
    >
      {/* Offline warning */}
      {offlineIndicator}

      {/* Main content - scrollable */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          pb: 10, // Space for sticky action bar
        }}
      >
        <DocumentTemplateGrid
          categories={categories}
          templates={templates}
          selections={selections}
          isLoading={!flagsReady || isLoading}
          error={error}
          onToggleTemplate={toggleTemplate}
          onPageCountChange={setTemplatePageCount}
          onCollapseToggle={toggleCategoryCollapse}
          onRetry={handleRetry}
        />
      </Box>

      {/* Sticky action bar */}
      <DocumentActionBar
        selectedCount={selectedCount}
        totalCount={templates.length}
        canProceed={canProceed}
        isLoading={false}
        onNext={handleNext}
      />
    </Box>
  );
}
