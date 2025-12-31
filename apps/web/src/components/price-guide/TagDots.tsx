/**
 * TagDots - Compact colored dot indicators for tags.
 * Shows small colored circles with tooltip for full tag names.
 */
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { TagSummary } from '@shared/types';

export type TagDotsProps = {
  /** Tags to display as dots */
  tags: TagSummary[];
  /** Maximum number of dots to show before "+N" overflow (default: 5) */
  maxDots?: number;
  /** Size of each dot in pixels (default: 10) */
  dotSize?: number;
};

/**
 * Renders a row of small colored dots representing tags.
 * Hovering shows a tooltip with the full tag names.
 */
export function TagDots({
  tags,
  maxDots = 5,
  dotSize = 10,
}: TagDotsProps): React.ReactElement | null {
  if (tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, maxDots);
  const overflowCount = tags.length - maxDots;
  const hasOverflow = overflowCount > 0;

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      {tags.map(tag => (
        <Box
          key={tag.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.25,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: tag.color,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption">{tag.name}</Typography>
        </Box>
      ))}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'default',
        }}
      >
        {visibleTags.map(tag => (
          <Box
            key={tag.id}
            sx={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              bgcolor: tag.color,
              border: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          />
        ))}
        {hasOverflow && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.65rem',
              fontWeight: 500,
              ml: 0.25,
            }}
          >
            +{overflowCount}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}
