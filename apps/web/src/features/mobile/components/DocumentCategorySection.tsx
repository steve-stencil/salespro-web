/**
 * Document Category Section component.
 * Displays a collapsible category header with a grid of template tiles.
 * Based on iOS: CollectionHeaderView, section in ContractObjectSelectionCollectionViewController
 */
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';

import { DocumentTemplateTile } from './DocumentTemplateTile';

import type { DocumentCategorySectionProps } from '../types/document';
import type React from 'react';

/**
 * Category section component displaying a group of templates.
 * Features a collapsible header and responsive grid of template tiles.
 *
 * @param props - Section props
 * @returns Section element
 */
export function DocumentCategorySection({
  category,
  templates,
  selections,
  onToggleTemplate,
  onPageCountChange,
  onCollapseToggle,
}: DocumentCategorySectionProps): React.ReactElement {
  const handleHeaderClick = useCallback((): void => {
    onCollapseToggle(category.id);
  }, [category.id, onCollapseToggle]);

  // Count selected templates in this category
  const selectedCount = templates.filter(t => selections.has(t.id)).length;

  return (
    <Box
      component="section"
      sx={{ mb: 2 }}
      aria-label={`${category.name} category`}
    >
      {/* Category Header */}
      <Box
        onClick={handleHeaderClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 2,
          bgcolor: 'grey.100',
          borderRadius: 1,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            bgcolor: 'grey.200',
          },
        }}
        role="button"
        aria-expanded={!category.isCollapsed}
        aria-controls={`category-content-${category.id}`}
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleHeaderClick();
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            {category.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              bgcolor: 'grey.300',
              px: 1,
              py: 0.25,
              borderRadius: 0.5,
            }}
          >
            {selectedCount > 0
              ? `${selectedCount}/${templates.length} selected`
              : `${templates.length} templates`}
          </Typography>
        </Box>

        <IconButton
          size="small"
          aria-label={
            category.isCollapsed ? 'Expand section' : 'Collapse section'
          }
          sx={{ ml: 1 }}
        >
          {category.isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>

      {/* Template Grid */}
      <Collapse
        in={!category.isCollapsed}
        timeout="auto"
        unmountOnExit
        id={`category-content-${category.id}`}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(5, 1fr)',
              xl: 'repeat(6, 1fr)',
            },
            gap: 2,
            p: 2,
            justifyItems: 'center',
          }}
        >
          {templates.map(template => {
            const selection = selections.get(template.id);
            const isSelected = !!selection;
            const addedCount = selection?.pageCount ?? 0;

            return (
              <DocumentTemplateTile
                key={template.id}
                template={template}
                isSelected={isSelected}
                addedCount={addedCount}
                onToggle={onToggleTemplate}
                onPageCountChange={onPageCountChange}
              />
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}
