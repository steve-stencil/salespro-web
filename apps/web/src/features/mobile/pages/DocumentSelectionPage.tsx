/**
 * Document Selection Page.
 * Entry point for the document template selection workflow.
 * Based on iOS: ContractObjectSelectionCollectionViewController
 */
import Box from '@mui/material/Box';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DocumentActionBar } from '../components/DocumentActionBar';
import { DocumentTemplateGrid } from '../components/DocumentTemplateGrid';
import { useDocumentTemplates } from '../hooks/useDocumentTemplates';

import type React from 'react';

/**
 * Sort mode for templates.
 */
type SortMode = 'alphabetic' | 'order';

/**
 * Document Selection Page component.
 * Displays the template grid with selection capabilities.
 *
 * @returns Page element
 */
export function DocumentSelectionPage(): React.ReactElement {
  const { estimateId } = useParams<{ estimateId: string }>();
  const navigate = useNavigate();
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [isNavigating, setIsNavigating] = useState(false);

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
    sort: sortMode,
    enabled: true,
  });

  /**
   * Handle NEXT button click.
   * Navigates to the preview/form step.
   */
  const handleNext = useCallback((): void => {
    if (!estimateId || selectedCount === 0) return;

    setIsNavigating(true);

    // Collect selected template IDs with page counts
    const selectedTemplates = Array.from(selections.entries()).map(
      ([templateId, selection]) => ({
        templateId,
        pageCount: selection.pageCount,
      }),
    );

    // Store selection in session storage for the next step
    sessionStorage.setItem(
      `document-selection-${estimateId}`,
      JSON.stringify(selectedTemplates),
    );

    // Navigate to preview/form step
    void navigate(`/mobile/contracts/${estimateId}/preview`);
  }, [estimateId, selectedCount, selections, navigate]);

  /**
   * Handle SORT button click.
   * Toggles between alphabetic and order sort.
   */
  const handleSort = useCallback((): void => {
    setSortMode(prev => (prev === 'alphabetic' ? 'order' : 'alphabetic'));
  }, []);

  /**
   * Handle retry after error.
   */
  const handleRetry = useCallback((): void => {
    refetch();
  }, [refetch]);

  // Can proceed if at least one template is selected
  const canProceed = selectedCount > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
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
          isLoading={isLoading}
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
        isLoading={isNavigating}
        onNext={handleNext}
        onSort={handleSort}
        sortMode={sortMode}
      />
    </Box>
  );
}
