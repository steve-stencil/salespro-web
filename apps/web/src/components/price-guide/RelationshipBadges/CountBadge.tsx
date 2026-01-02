/**
 * CountBadge - Generic count badge for options, upcharges, offices.
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { SxProps, Theme } from '@mui/material/styles';

export type CountBadgeVariant = 'option' | 'upcharge' | 'office' | 'detail';

export type CountBadgeProps = {
  /** Count to display */
  count: number;
  /** Type of item being counted */
  variant: CountBadgeVariant;
  /** Optional list of item names to show in tooltip */
  items?: string[];
  /** Custom sx props */
  sx?: SxProps<Theme>;
};

const variantConfig: Record<
  CountBadgeVariant,
  {
    singularLabel: string;
    pluralLabel: string;
    color: 'primary' | 'secondary' | 'default';
  }
> = {
  option: { singularLabel: 'opt', pluralLabel: 'opts', color: 'primary' },
  upcharge: { singularLabel: 'uc', pluralLabel: 'ucs', color: 'secondary' },
  office: { singularLabel: 'office', pluralLabel: 'offices', color: 'default' },
  detail: { singularLabel: 'detail', pluralLabel: 'details', color: 'default' },
};

/**
 * Generic count badge for displaying counts of linked items.
 */
export function CountBadge({
  count,
  variant,
  items,
  sx,
}: CountBadgeProps): React.ReactElement {
  const config = variantConfig[variant];
  const label = `${count} ${count === 1 ? config.singularLabel : config.pluralLabel}`;

  const headerLabel = (() => {
    switch (variant) {
      case 'option':
        return count === 1 ? '1 option linked' : `${count} options linked`;
      case 'upcharge':
        return count === 1 ? '1 upcharge linked' : `${count} upcharges linked`;
      case 'office':
        return count === 1
          ? 'Available in 1 office'
          : `Available in ${count} offices`;
      case 'detail':
        return count === 1
          ? '1 additional detail'
          : `${count} additional details`;
    }
  })();

  // Build tooltip content - show list if items provided
  const tooltipContent =
    items && items.length > 0 ? (
      <Box sx={{ maxWidth: 250 }}>
        <Typography variant="caption" fontWeight={600} display="block" mb={0.5}>
          {headerLabel}
        </Typography>
        {items.slice(0, 10).map((item, index) => (
          <Typography
            key={index}
            variant="caption"
            display="block"
            sx={{ pl: 1, py: 0.25 }}
          >
            • {item}
          </Typography>
        ))}
        {items.length > 10 && (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ pl: 1, pt: 0.5 }}
          >
            +{items.length - 10} more...
          </Typography>
        )}
      </Box>
    ) : (
      headerLabel
    );

  return (
    <Tooltip title={tooltipContent} arrow>
      <Chip
        label={label}
        size="small"
        color={count > 0 ? config.color : 'default'}
        variant={count > 0 ? 'filled' : 'outlined'}
        sx={{
          minWidth: 60,
          ...sx,
        }}
      />
    </Tooltip>
  );
}
