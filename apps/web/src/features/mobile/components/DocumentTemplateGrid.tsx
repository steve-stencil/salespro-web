/**
 * Document Template Grid component.
 * Main container for displaying all template categories and templates.
 * Based on iOS: ContractObjectSelectionCollectionViewController
 */
import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import { DocumentCategorySection } from './DocumentCategorySection';
import { DocumentTemplateTileSkeleton } from './DocumentTemplateTile';

import type {
  DocumentCategory,
  DocumentTemplate,
  DocumentTemplateGridProps,
} from '../types/document';
import type React from 'react';

/**
 * Groups templates by their category ID.
 *
 * @param templates - All templates
 * @param categories - All categories
 * @returns Map of category ID to templates
 */
function groupTemplatesByCategory(
  templates: DocumentTemplate[],
  categories: DocumentCategory[],
): Map<string, DocumentTemplate[]> {
  const grouped = new Map<string, DocumentTemplate[]>();

  // Initialize with empty arrays for all categories
  for (const category of categories) {
    grouped.set(category.id, []);
  }

  // Group templates
  for (const template of templates) {
    const existing = grouped.get(template.categoryId);
    if (existing) {
      existing.push(template);
    }
  }

  // Sort templates within each category
  for (const [, categoryTemplates] of grouped) {
    categoryTemplates.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return grouped;
}

/**
 * Loading skeleton for the template grid.
 *
 * @returns Skeleton element
 */
function LoadingSkeleton(): React.ReactElement {
  return (
    <Box sx={{ p: 2 }}>
      {/* Instruction text skeleton */}
      <Skeleton variant="text" width={300} sx={{ mb: 3 }} />

      {/* Category skeletons */}
      {[1, 2, 3].map(i => (
        <Box key={i} sx={{ mb: 3 }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height={48}
            sx={{ borderRadius: 1, mb: 2 }}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 2,
              justifyItems: 'center',
            }}
          >
            {[1, 2, 3, 4].map(j => (
              <DocumentTemplateTileSkeleton key={j} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Empty state when no templates are available.
 *
 * @param props - Props with onRetry handler
 * @returns Empty state element
 */
function EmptyState({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 2,
        textAlign: 'center',
      }}
    >
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No Templates Available
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        There are no document templates configured for this estimate.
      </Typography>
      <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry}>
        Refresh
      </Button>
    </Box>
  );
}

/**
 * Error state when template loading fails.
 *
 * @param props - Props with error and onRetry handler
 * @returns Error state element
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <Box sx={{ p: 2 }}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
        sx={{ mb: 2 }}
      >
        Failed to load templates: {error.message}
      </Alert>
    </Box>
  );
}

/**
 * Main template grid component.
 * Displays categories with their templates in a responsive grid layout.
 *
 * @param props - Grid props
 * @returns Grid element
 */
export function DocumentTemplateGrid({
  categories,
  templates,
  selections,
  isLoading,
  error,
  onToggleTemplate,
  onPageCountChange,
  onCollapseToggle,
  onRetry,
}: DocumentTemplateGridProps): React.ReactElement {
  // Group templates by category
  const templatesByCategory = useMemo(
    () => groupTemplatesByCategory(templates, categories),
    [templates, categories],
  );

  // Sort categories by sort order
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  // Empty state
  if (templates.length === 0) {
    return <EmptyState onRetry={onRetry} />;
  }

  return (
    <Box sx={{ pb: 2 }}>
      {/* Instruction text - matches iOS heading */}
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          px: 2,
          py: 1.5,
          fontSize: '0.85rem',
        }}
      >
        Tap the templates you want to include in your document
      </Typography>

      {/* Category sections */}
      {sortedCategories.map(category => {
        const categoryTemplates = templatesByCategory.get(category.id) ?? [];
        if (categoryTemplates.length === 0) {
          return null;
        }

        return (
          <DocumentCategorySection
            key={category.id}
            category={category}
            templates={categoryTemplates}
            selections={selections}
            onToggleTemplate={onToggleTemplate}
            onPageCountChange={onPageCountChange}
            onCollapseToggle={onCollapseToggle}
          />
        );
      })}
    </Box>
  );
}
