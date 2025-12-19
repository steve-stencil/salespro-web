/**
 * Category card grid component for displaying categories as folder cards.
 */
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { CategoryCard } from './CategoryCard';

import type { PriceGuideCategoryListItem } from '@shared/core';

type CategoryCardGridProps = {
  /** Categories to display. */
  categories: PriceGuideCategoryListItem[];
  /** Whether data is loading. */
  isLoading?: boolean;
  /** Callback when a category is clicked. */
  onCategoryClick: (categoryId: string) => void;
  /** Callback when a category name is renamed. */
  onRename: (categoryId: string, newName: string) => void;
  /** Callback when Edit menu item is clicked. */
  onEdit: (category: PriceGuideCategoryListItem) => void;
  /** Callback when Move menu item is clicked. */
  onMove: (category: PriceGuideCategoryListItem) => void;
  /** Callback when Delete menu item is clicked. */
  onDelete: (category: PriceGuideCategoryListItem) => void;
  /** Whether actions are disabled. */
  actionsDisabled?: boolean;
  /** Empty state message. */
  emptyMessage?: string;
};

/**
 * Skeleton card for loading state.
 */
function CategoryCardSkeleton(): React.ReactElement {
  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        height: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Skeleton variant="circular" width={64} height={64} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="60%" height={28} />
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Skeleton variant="rounded" width={80} height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
      </Box>
    </Box>
  );
}

/**
 * Grid layout for displaying category cards.
 */
export function CategoryCardGrid({
  categories,
  isLoading = false,
  onCategoryClick,
  onRename,
  onEdit,
  onMove,
  onDelete,
  actionsDisabled = false,
  emptyMessage = 'No categories found.',
}: CategoryCardGridProps): React.ReactElement {
  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
            <CategoryCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (categories.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 2,
          backgroundColor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {categories.map(category => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={category.id}>
          <CategoryCard
            category={category}
            onClick={onCategoryClick}
            onRename={onRename}
            onEdit={onEdit}
            onMove={onMove}
            onDelete={onDelete}
            actionsDisabled={actionsDisabled}
          />
        </Grid>
      ))}
    </Grid>
  );
}
