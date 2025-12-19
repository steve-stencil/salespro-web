/**
 * Category breadcrumb navigation component.
 * Shows path from root to current category.
 */
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import type { PriceGuideCategoryBreadcrumb as BreadcrumbItem } from '@shared/core';

type CategoryBreadcrumbProps = {
  /** Breadcrumb path items. */
  breadcrumb: BreadcrumbItem[];
  /** Whether breadcrumb data is loading. */
  isLoading?: boolean;
  /** Callback when a breadcrumb item is clicked. */
  onNavigate: (categoryId: string | null) => void;
};

/**
 * Breadcrumb navigation for price guide categories.
 * Shows "Home" as root, then each ancestor category.
 */
export function CategoryBreadcrumb({
  breadcrumb,
  isLoading = false,
  onNavigate,
}: CategoryBreadcrumbProps): React.ReactElement {
  if (isLoading) {
    return (
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
        <Skeleton width={60} height={24} />
        <Skeleton width={80} height={24} />
      </Breadcrumbs>
    );
  }

  const items = breadcrumb.slice(0, -1); // All but last
  const current = breadcrumb[breadcrumb.length - 1]; // Last item (current)

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="Category navigation"
      sx={{ mb: 1 }}
    >
      <Link
        component="button"
        underline="hover"
        color="inherit"
        onClick={() => onNavigate(null)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          border: 'none',
          background: 'none',
          fontSize: 'inherit',
        }}
      >
        <HomeIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
        Home
      </Link>

      {items.map(item => (
        <Link
          key={item.id}
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => onNavigate(item.id)}
          sx={{
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            fontSize: 'inherit',
          }}
        >
          {item.name}
        </Link>
      ))}

      {current && (
        <Typography color="text.primary" sx={{ fontWeight: 500 }}>
          {current.name}
        </Typography>
      )}
    </Breadcrumbs>
  );
}
