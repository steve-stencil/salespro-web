/**
 * EntityCardSkeleton - Loading skeleton for EntityCard component.
 */
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';

export type EntityCardSkeletonProps = {
  /** Show checkbox placeholder */
  showCheckbox?: boolean;
  /** Show expand toggle placeholder */
  showExpand?: boolean;
  /** Number of badges to show */
  badgeCount?: number;
};

/**
 * Loading skeleton for EntityCard.
 */
export function EntityCardSkeleton({
  showCheckbox = true,
  showExpand = true,
  badgeCount = 3,
}: EntityCardSkeletonProps): React.ReactElement {
  return (
    <Card sx={{ mb: 1 }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {showCheckbox && (
            <Skeleton variant="circular" width={24} height={24} />
          )}
          {showExpand && <Skeleton variant="circular" width={32} height={32} />}
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          {[...Array(badgeCount)].map((_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              width={index === badgeCount - 1 ? 90 : 70}
              height={24}
            />
          ))}
          <Skeleton variant="circular" width={32} height={32} />
        </Box>
      </CardContent>
    </Card>
  );
}
