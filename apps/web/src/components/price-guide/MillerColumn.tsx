/**
 * Individual column component for Miller Columns view.
 * Displays a list of categories with selection highlighting and navigation indicators.
 */
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import type { PriceGuideCategoryListItem } from '@shared/core';

type MillerColumnProps = {
  /** Title shown at the top of the column. */
  title?: string;
  /** Categories to display in this column. */
  categories: PriceGuideCategoryListItem[];
  /** Whether categories are loading. */
  isLoading?: boolean;
  /** ID of the selected category in this column. */
  selectedId: string | null;
  /** Callback when a category is selected. */
  onSelect: (category: PriceGuideCategoryListItem) => void;
  /** Callback when context menu is triggered. */
  onContextMenu: (
    event: React.MouseEvent,
    category: PriceGuideCategoryListItem,
  ) => void;
  /** Callback when create button is clicked. */
  onCreate?: () => void;
  /** Whether this is a dimmed context column. */
  isContextColumn?: boolean;
  /** Message to show when column is empty. */
  emptyMessage?: string;
  /** Placeholder when no selection has been made. */
  placeholder?: string;
};

/**
 * Skeleton loader for column items.
 */
function ColumnSkeleton(): React.ReactElement {
  return (
    <Box sx={{ p: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 1,
            px: 1.5,
          }}
        >
          <Skeleton variant="text" width="70%" height={24} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="circular" width={20} height={20} />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Empty state display for column.
 */
function EmptyState({
  message,
  onCreate,
}: {
  message: string;
  onCreate?: () => void;
}): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {message}
      </Typography>
      {onCreate && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onCreate}
        >
          Create subcategory
        </Button>
      )}
    </Box>
  );
}

/**
 * Placeholder display when no selection has been made.
 */
function Placeholder({ message }: { message: string }): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 3,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

/**
 * Individual column in a Miller Columns layout.
 * Shows a list of categories with selection highlighting and navigation chevrons.
 */
export function MillerColumn({
  title,
  categories,
  isLoading = false,
  selectedId,
  onSelect,
  onContextMenu,
  onCreate,
  isContextColumn = false,
  emptyMessage = 'No subcategories',
  placeholder,
}: MillerColumnProps): React.ReactElement {
  // Show placeholder if specified and no categories
  if (placeholder && !isLoading && categories.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          minWidth: 0,
          flex: 1,
        }}
      >
        {title && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              backgroundColor: 'action.hover',
            }}
          >
            <Typography variant="subtitle2" noWrap>
              {title}
            </Typography>
          </Box>
        )}
        <Placeholder message={placeholder} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        minWidth: 0,
        flex: 1,
        opacity: isContextColumn ? 0.7 : 1,
      }}
      role="tree"
      aria-label={title ?? 'Category list'}
    >
      {/* Column header */}
      {title && (
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: isContextColumn
              ? 'action.selected'
              : 'action.hover',
          }}
        >
          <Typography variant="subtitle2" noWrap>
            {title}
          </Typography>
        </Box>
      )}

      {/* Column content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <ColumnSkeleton />
        ) : categories.length === 0 ? (
          <EmptyState message={emptyMessage} onCreate={onCreate} />
        ) : (
          <List dense disablePadding>
            {categories.map(category => {
              const isSelected = category.id === selectedId;
              const hasChildren = category.childCount > 0;

              return (
                <ListItem
                  key={category.id}
                  disablePadding
                  role="treeitem"
                  aria-selected={isSelected}
                  aria-expanded={hasChildren ? isSelected : undefined}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={e => onContextMenu(e, category)}
                      sx={{
                        opacity: 0,
                        '.MuiListItem-root:hover &': { opacity: 1 },
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(category)}
                    onContextMenu={e => onContextMenu(e, category)}
                    sx={{
                      pr: 6,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                        '& .MuiChip-root': {
                          backgroundColor: 'primary.light',
                          color: 'primary.contrastText',
                        },
                        '& .MuiSvgIcon-root': {
                          color: 'primary.contrastText',
                        },
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              flex: 1,
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          >
                            {category.name}
                          </Typography>
                          {!category.isActive && (
                            <Chip
                              label="Inactive"
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                          {category.itemCount > 0 && (
                            <Chip
                              label={category.itemCount}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      }
                    />
                    {hasChildren && (
                      <ChevronRightIcon
                        fontSize="small"
                        sx={{ ml: 1, color: 'text.secondary' }}
                      />
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* Create button at bottom */}
      {onCreate && categories.length > 0 && (
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
          <Button
            fullWidth
            size="small"
            startIcon={<AddIcon />}
            onClick={onCreate}
          >
            Add category
          </Button>
        </Box>
      )}
    </Box>
  );
}
