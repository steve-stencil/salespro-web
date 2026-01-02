/**
 * Tag Management Page.
 * Provides CRUD interface for managing tags used to organize library items.
 */
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useEffect } from 'react';

import { TagChip } from '../../components/price-guide';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  useTagList,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from '../../hooks/useTags';

import type { TagSummary } from '@shared/types';

// ============================================================================
// Constants
// ============================================================================

/** Default colors for new tags */
const TAG_COLORS = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#F97316', label: 'Orange' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#84CC16', label: 'Lime' },
  { value: '#9CA3AF', label: 'Gray' },
];

// ============================================================================
// Color Picker Component
// ============================================================================

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

/**
 * Validates and normalizes a hex color string.
 * Returns the normalized color or null if invalid.
 */
function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  // Add # if missing
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  // Valid hex patterns: #RGB, #RRGGBB
  const hexPattern = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;
  if (!hexPattern.test(withHash)) return null;
  return withHash.toUpperCase();
}

/**
 * Checks if the color is a preset color.
 */
function isPresetColor(color: string): boolean {
  return TAG_COLORS.some(
    preset => preset.value.toUpperCase() === color.toUpperCase(),
  );
}

function ColorPicker({
  value,
  onChange,
}: ColorPickerProps): React.ReactElement {
  const [customHexInput, setCustomHexInput] = useState(value);
  const [hexError, setHexError] = useState<string | null>(null);

  const isCustomSelected = !isPresetColor(value);

  // Sync input when value changes externally (e.g., when editing an existing tag)
  useEffect(() => {
    setCustomHexInput(value);
  }, [value]);

  /**
   * Handles selecting a preset color.
   */
  const handlePresetSelect = (presetColor: string) => {
    onChange(presetColor);
    setHexError(null);
  };

  /**
   * Handles changes from the native color picker input.
   */
  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.toUpperCase();
    setCustomHexInput(newColor);
    onChange(newColor);
    setHexError(null);
  };

  /**
   * Handles manual hex input changes.
   */
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setCustomHexInput(inputValue);

    const normalized = normalizeHexColor(inputValue);
    if (normalized) {
      onChange(normalized);
      setHexError(null);
    } else if (inputValue.length > 0) {
      setHexError('Invalid hex color');
    } else {
      setHexError(null);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Color
      </Typography>

      {/* Preset Colors */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {TAG_COLORS.map(color => (
          <Tooltip key={color.value} title={color.label}>
            <Box
              onClick={() => handlePresetSelect(color.value)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: color.value,
                cursor: 'pointer',
                border: 3,
                borderColor:
                  value.toUpperCase() === color.value.toUpperCase()
                    ? 'primary.main'
                    : 'transparent',
                transition: 'border-color 0.2s, transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            />
          </Tooltip>
        ))}
      </Box>

      {/* Custom Color Section */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1.5,
          borderRadius: 1,
          bgcolor: isCustomSelected ? 'action.selected' : 'action.hover',
          border: 1,
          borderColor: isCustomSelected ? 'primary.main' : 'divider',
          transition: 'all 0.2s',
        }}
      >
        {/* Native Color Picker */}
        <Tooltip title="Pick custom color">
          <Box
            component="label"
            sx={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: '50%',
              cursor: 'pointer',
              overflow: 'hidden',
              border: 2,
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'primary.main',
              },
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: value,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <EditIcon
                sx={{
                  fontSize: 16,
                  color: 'white',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                }}
              />
            </Box>
            <input
              type="color"
              value={value}
              onChange={handleNativeColorChange}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                top: 0,
                left: 0,
              }}
            />
          </Box>
        </Tooltip>

        {/* Hex Input */}
        <TextField
          size="small"
          label="Hex Color"
          value={customHexInput}
          onChange={handleHexInputChange}
          error={!!hexError}
          helperText={hexError}
          placeholder="#FF5500"
          sx={{ width: 140 }}
          InputProps={{
            sx: { fontFamily: 'monospace' },
          }}
        />

        <Typography variant="caption" color="text.secondary">
          Custom
        </Typography>
      </Box>
    </Box>
  );
}

// ============================================================================
// Create/Edit Tag Dialog
// ============================================================================

type TagDialogProps = {
  open: boolean;
  tag: TagSummary | null;
  onClose: () => void;
  onSave: (name: string, color: string) => Promise<void>;
  isLoading: boolean;
};

function TagDialog({
  open,
  tag,
  onClose,
  onSave,
  isLoading,
}: TagDialogProps): React.ReactElement {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? '#3B82F6');
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or tag changes
  const handleOpen = useCallback(() => {
    setName(tag?.name ?? '');
    setColor(tag?.color ?? '#3B82F6');
    setError(null);
  }, [tag]);

  const handleClose = () => {
    setName('');
    setColor('#3B82F6');
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Tag name is required');
      return;
    }

    try {
      await onSave(name.trim(), color);
      handleClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save tag');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      TransitionProps={{ onEnter: handleOpen }}
    >
      <DialogTitle>{tag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Tag Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            error={!!error}
            helperText={error}
          />
          <ColorPicker value={color} onChange={setColor} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Preview
            </Typography>
            <TagChip tag={{ id: 'preview', name: name || 'Tag Name', color }} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={!name.trim() || isLoading}
          startIcon={
            isLoading ? (
              <CircularProgress size={16} />
            ) : tag ? (
              <EditIcon />
            ) : (
              <AddIcon />
            )
          }
        >
          {tag ? 'Save Changes' : 'Create Tag'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

type DeleteDialogProps = {
  open: boolean;
  tag: TagSummary | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
};

function DeleteDialog({
  open,
  tag,
  onClose,
  onConfirm,
  isLoading,
}: DeleteDialogProps): React.ReactElement {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Tag</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the tag <strong>{tag?.name}</strong>?
          This will remove the tag from all items it's currently assigned to.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => void handleConfirm()}
          disabled={isLoading}
          startIcon={
            isLoading ? <CircularProgress size={16} /> : <DeleteIcon />
          }
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function TableRowSkeleton(): React.ReactElement {
  return (
    <TableRow>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width={120} />
        </Box>
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={80} height={24} />
      </TableCell>
      <TableCell align="right">
        <Skeleton variant="rounded" width={80} height={32} />
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TagManagementPage(): React.ReactElement {
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTag, setEditTag] = useState<TagSummary | null>(null);
  const [deleteTag, setDeleteTag] = useState<TagSummary | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Fetch tags
  const {
    data: tagsData,
    isLoading,
    error,
  } = useTagList(debouncedSearch || undefined);

  // Mutations
  const createTagMutation = useCreateTag();
  const updateTagMutation = useUpdateTag();
  const deleteTagMutation = useDeleteTag();

  const handleCreateTag = useCallback(
    async (name: string, color: string) => {
      await createTagMutation.mutateAsync({ name, color });
    },
    [createTagMutation],
  );

  const handleUpdateTag = useCallback(
    async (name: string, color: string) => {
      if (!editTag) return;
      await updateTagMutation.mutateAsync({
        tagId: editTag.id,
        data: { name, color },
      });
    },
    [editTag, updateTagMutation],
  );

  const handleDeleteTag = useCallback(async () => {
    if (!deleteTag) return;
    await deleteTagMutation.mutateAsync(deleteTag.id);
  }, [deleteTag, deleteTagMutation]);

  const tags = tagsData?.tags ?? [];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalOfferIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" component="h1">
              Tag Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create and manage tags for organizing library items
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New Tag
        </Button>
      </Box>

      {/* Content Card */}
      <Card>
        <CardContent>
          {/* Search */}
          <Box sx={{ mb: 3 }}>
            <TextField
              placeholder="Search tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              sx={{ width: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load tags. Please try again.
            </Alert>
          )}

          {/* Tags Table */}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tag Name</TableCell>
                  <TableCell>Preview</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
                ) : tags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {search
                          ? 'No tags match your search.'
                          : 'No tags found. Create one to get started.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  tags.map(tag => (
                    <TableRow key={tag.id} hover>
                      <TableCell>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                        >
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: tag.color,
                            }}
                          />
                          <Typography variant="body2" fontWeight={500}>
                            {tag.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <TagChip tag={tag} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => setEditTag(tag)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteTag(tag)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Tag Count */}
          {!isLoading && tags.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {tags.length} tag{tags.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <TagDialog
        open={createDialogOpen}
        tag={null}
        onClose={() => setCreateDialogOpen(false)}
        onSave={handleCreateTag}
        isLoading={createTagMutation.isPending}
      />

      {/* Edit Dialog */}
      <TagDialog
        open={!!editTag}
        tag={editTag}
        onClose={() => setEditTag(null)}
        onSave={handleUpdateTag}
        isLoading={updateTagMutation.isPending}
      />

      {/* Delete Dialog */}
      <DeleteDialog
        open={!!deleteTag}
        tag={deleteTag}
        onClose={() => setDeleteTag(null)}
        onConfirm={handleDeleteTag}
        isLoading={deleteTagMutation.isPending}
      />
    </Box>
  );
}
