/**
 * CountBadge - Generic count badge for options, upcharges, offices.
 */
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import type { SxProps, Theme } from '@mui/material/styles';

export type CountBadgeVariant = 'option' | 'upcharge' | 'office' | 'detail';

export type CountBadgeProps = {
  /** Count to display */
  count: number;
  /** Type of item being counted */
  variant: CountBadgeVariant;
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
  sx,
}: CountBadgeProps): React.ReactElement {
  const config = variantConfig[variant];
  const label = `${count} ${count === 1 ? config.singularLabel : config.pluralLabel}`;
  const tooltipLabel = (() => {
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

  return (
    <Tooltip title={tooltipLabel} arrow>
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
