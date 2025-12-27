/**
 * Loading State Components for Price Guide.
 * Provides consistent loading skeletons and spinners.
 */

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ============================================================================
// Full Page Loading
// ============================================================================

type PageLoadingProps = {
  message?: string;
};

export function PageLoading({
  message = 'Loading...',
}: PageLoadingProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 400,
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Card Skeleton
// ============================================================================

export function CardSkeleton(): React.ReactElement {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          <Skeleton variant="rounded" width={80} height={32} />
        </Stack>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// List Skeleton
// ============================================================================

type ListSkeletonProps = {
  count?: number;
};

export function ListSkeleton({
  count = 5,
}: ListSkeletonProps): React.ReactElement {
  return (
    <Box>
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </Box>
  );
}

// ============================================================================
// Grid Skeleton
// ============================================================================

type GridSkeletonProps = {
  rows?: number;
  cols?: number;
};

export function GridSkeleton({
  rows = 5,
  cols = 4,
}: GridSkeletonProps): React.ReactElement {
  return (
    <Box sx={{ overflow: 'auto' }}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {/* Header Row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `200px repeat(${cols}, 1fr)`,
            gap: 1,
          }}
        >
          <Skeleton variant="text" height={40} />
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} variant="text" height={40} />
          ))}
        </Box>
        {/* Data Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Box
            key={rowIndex}
            sx={{
              display: 'grid',
              gridTemplateColumns: `200px repeat(${cols}, 1fr)`,
              gap: 1,
            }}
          >
            <Skeleton variant="text" height={40} />
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="rounded" height={36} />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ============================================================================
// Form Skeleton
// ============================================================================

export function FormSkeleton(): React.ReactElement {
  return (
    <Stack spacing={3}>
      <Box>
        <Skeleton variant="text" width={100} height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={56} />
      </Box>
      <Box>
        <Skeleton variant="text" width={100} height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={56} />
      </Box>
      <Box>
        <Skeleton variant="text" width={100} height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={120} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Skeleton variant="rounded" width={100} height={36} />
        <Skeleton variant="rounded" width={100} height={36} />
      </Box>
    </Stack>
  );
}

// ============================================================================
// Detail Page Skeleton
// ============================================================================

export function DetailPageSkeleton(): React.ReactElement {
  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <Skeleton variant="circular" width={48} height={48} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="text" width="30%" height={20} />
        </Box>
        <Skeleton variant="rounded" width={100} height={36} />
        <Skeleton variant="rounded" width={100} height={36} />
      </Stack>

      {/* Cards */}
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width={150} height={28} sx={{ mb: 2 }} />
            <Stack spacing={2}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 2 }}>
                  <Skeleton variant="text" width={120} height={24} />
                  <Skeleton variant="text" width="50%" height={24} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Skeleton variant="text" width={150} height={28} sx={{ mb: 2 }} />
            <ListSkeleton count={3} />
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

// ============================================================================
// Inline Loading
// ============================================================================

type InlineLoadingProps = {
  size?: number;
  text?: string;
};

export function InlineLoading({
  size = 20,
  text,
}: InlineLoadingProps): React.ReactElement {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <CircularProgress size={size} />
      {text && (
        <Typography variant="body2" color="text.secondary">
          {text}
        </Typography>
      )}
    </Box>
  );
}

// ============================================================================
// Empty State
// ============================================================================

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 4,
        textAlign: 'center',
      }}
    >
      {icon && (
        <Box sx={{ color: 'text.disabled', mb: 2, fontSize: 64 }}>{icon}</Box>
      )}
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, maxWidth: 400 }}
        >
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
