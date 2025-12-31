/**
 * ImagePicker Component.
 * Reusable modal for selecting images from the shared library or uploading new ones.
 * Supports both single and multi-select modes.
 * When uploading, the image is added to the library AND selected.
 */

import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClearIcon from '@mui/icons-material/Clear';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
  useEffect,
} from 'react';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  useImageList,
  useUploadImage,
  priceGuideKeys,
} from '../../hooks/usePriceGuide';
import { useTagList, useSetItemTags } from '../../hooks/useTags';

import { TagAutocomplete } from './TagAutocomplete';
import { TagFilterSelect } from './TagFilterSelect';

import type { LinkedImage, TagSummary } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

/** Image data passed when selection changes */
export type SelectedImageData = {
  imageId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export type ImagePickerProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Currently selected image IDs */
  selectedImageIds: string[];
  /** Callback when selection changes - provides IDs and full image data */
  onSelectionChange: (imageIds: string[], images: SelectedImageData[]) => void;
  /** Allow multiple selection (default: true) */
  multiple?: boolean;
  /** Optional title override */
  title?: string;
};

// ============================================================================
// Image Selection Card
// ============================================================================

type ImageSelectionCardProps = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  isSelected: boolean;
  onToggle: (id: string) => void;
  multiple: boolean;
};

function ImageSelectionCard({
  id,
  name,
  thumbnailUrl,
  imageUrl,
  isSelected,
  onToggle,
  multiple,
}: ImageSelectionCardProps): React.ReactElement {
  return (
    <Card
      sx={{
        position: 'relative',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 2,
        },
      }}
    >
      <CardActionArea onClick={() => onToggle(id)}>
        <CardMedia
          component="img"
          image={thumbnailUrl ?? imageUrl ?? undefined}
          alt={name}
          sx={{
            height: 100,
            width: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            bgcolor: 'grey.100',
          }}
        />
        <Box sx={{ p: 1 }}>
          <Typography
            variant="caption"
            noWrap
            title={name}
            sx={{ fontWeight: 500 }}
          >
            {name}
          </Typography>
        </Box>
      </CardActionArea>

      {/* Selection indicator */}
      {multiple ? (
        <Checkbox
          checked={isSelected}
          size="small"
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            bgcolor: 'background.paper',
            borderRadius: 1,
            p: 0,
            '&:hover': { bgcolor: 'background.paper' },
          }}
        />
      ) : (
        isSelected && (
          <CheckCircleIcon
            color="primary"
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              bgcolor: 'background.paper',
              borderRadius: '50%',
            }}
          />
        )
      )}
    </Card>
  );
}

// ============================================================================
// Upload Panel Component
// ============================================================================

type UploadPanelProps = {
  onUploadSuccess: (image: SelectedImageData) => void;
  isUploading: boolean;
  setIsUploading: (value: boolean) => void;
  /** Ref to trigger upload from parent */
  uploadRef: React.RefObject<{ upload: () => Promise<void> } | null>;
  /** Callback when canUpload state changes */
  onCanUploadChange: (canUpload: boolean) => void;
};

function UploadPanel({
  onUploadSuccess,
  isUploading,
  setIsUploading,
  uploadRef,
  onCanUploadChange,
}: UploadPanelProps): React.ReactElement {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<TagSummary[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadImage();
  const setItemTagsMutation = useSetItemTags();
  const queryClient = useQueryClient();
  const { data: tagsData } = useTagList();
  const allTags = tagsData?.tags ?? [];

  const canUpload = !!file && !!name.trim() && !isUploading;

  // Notify parent when canUpload changes
  useEffect(() => {
    onCanUploadChange(canUpload);
  }, [canUpload, onCanUploadChange]);

  const processFile = useCallback(
    (selectedFile: File) => {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Validate file size (5MB max)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }

      setFile(selectedFile);
      setError(null);

      // Auto-fill name from filename if empty
      if (!name) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        setName(nameWithoutExt);
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    },
    [name],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile],
  );

  const handleUpload = async () => {
    if (!file || !name.trim()) return;

    setIsUploading(true);
    try {
      const result = await uploadMutation.mutateAsync({
        file,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      });

      // If tags were selected, assign them to the newly created image
      if (selectedTags.length > 0) {
        await setItemTagsMutation.mutateAsync({
          entityType: 'PRICE_GUIDE_IMAGE',
          entityId: result.item.id,
          tagIds: selectedTags.map(t => t.id),
        });
      }

      await queryClient.invalidateQueries({
        queryKey: priceGuideKeys.imageLists(),
      });

      // Reset form
      setName('');
      setDescription('');
      setFile(null);
      setPreview(null);
      setSelectedTags([]);

      // Notify parent of successful upload with full image data
      onUploadSuccess({
        imageId: result.item.id,
        name: result.item.name,
        description: result.item.description ?? null,
        imageUrl: result.item.imageUrl ?? null,
        thumbnailUrl: result.item.thumbnailUrl ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setPreview(null);
    setName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTagsChange = useCallback((newTags: TagSummary[]) => {
    setSelectedTags(newTags);
  }, []);

  // Expose upload method to parent
  useImperativeHandle(
    uploadRef,
    () => ({
      upload: handleUpload,
    }),
    [handleUpload],
  );

  return (
    <Stack spacing={2}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Preview or Upload Button */}
      {preview ? (
        <Box sx={{ position: 'relative' }}>
          <Box
            component="img"
            src={preview}
            alt="Preview"
            sx={{
              width: '100%',
              maxHeight: 200,
              objectFit: 'contain',
              borderRadius: 1,
              bgcolor: 'grey.100',
            }}
          />
          <IconButton
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'background.paper',
            }}
            onClick={handleClearFile}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <Box
          sx={{
            border: '2px dashed',
            borderColor: isDragOver ? 'primary.main' : 'grey.300',
            borderRadius: 1,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragOver ? 'action.hover' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'grey.50' },
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CloudUploadIcon
            sx={{
              fontSize: 48,
              color: isDragOver ? 'primary.main' : 'grey.400',
              mb: 1,
            }}
          />
          <Typography color={isDragOver ? 'primary.main' : 'text.secondary'}>
            {isDragOver
              ? 'Drop image here'
              : 'Click or drag to select an image'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            PNG, JPG, WebP, GIF up to 5MB
          </Typography>
        </Box>
      )}

      <TextField
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        fullWidth
        required
        size="small"
      />

      <TextField
        label="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        fullWidth
        multiline
        rows={2}
        size="small"
      />

      {/* Tags Section */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Tags (optional)
        </Typography>
        <TagAutocomplete
          value={selectedTags}
          onChange={handleTagsChange}
          options={allTags}
          label="Tags"
          placeholder="Add tags..."
        />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ImagePicker({
  open,
  onClose,
  selectedImageIds,
  onSelectionChange,
  multiple = true,
  title = 'Select Images',
}: ImagePickerProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  // Ref to control upload panel from dialog actions
  const uploadPanelRef = useRef<{ upload: () => Promise<void> } | null>(null);

  // Local selection state (committed on save)
  const [localSelection, setLocalSelection] = useState<string[]>([]);

  // Load available tags for filtering
  const { data: tagsData } = useTagList();
  const allTags = tagsData?.tags ?? [];

  // Sync local selection when dialog opens
  const handleDialogEnter = useCallback(() => {
    setLocalSelection(selectedImageIds);
    setSearch('');
    setSelectedTags([]);
    setActiveTab(0);
  }, [selectedImageIds]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useImageList({
      search: debouncedSearch || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      limit: 24,
    });

  // Flatten pages
  const images = useMemo(
    () => data?.pages.flatMap(page => page.items) ?? [],
    [data],
  );

  const handleToggle = useCallback(
    (imageId: string) => {
      if (multiple) {
        setLocalSelection(prev =>
          prev.includes(imageId)
            ? prev.filter(id => id !== imageId)
            : [...prev, imageId],
        );
      } else {
        setLocalSelection([imageId]);
      }
    },
    [multiple],
  );

  const handleClear = useCallback(() => {
    setLocalSelection([]);
  }, []);

  const handleSave = useCallback(() => {
    // Build image data for all selected images
    const selectedImages: SelectedImageData[] = localSelection
      .map(id => {
        const image = images.find(img => img.id === id);
        if (!image) return null;
        return {
          imageId: image.id,
          name: image.name,
          description: image.description,
          imageUrl: image.imageUrl,
          thumbnailUrl: image.thumbnailUrl,
        };
      })
      .filter((img): img is SelectedImageData => img !== null);

    onSelectionChange(localSelection, selectedImages);
    onClose();
  }, [localSelection, images, onSelectionChange, onClose]);

  const handleCancel = useCallback(() => {
    if (!isUploading) {
      onClose();
    }
  }, [onClose, isUploading]);

  // When upload succeeds, handle based on selection mode
  const handleUploadSuccess = useCallback(
    (image: SelectedImageData) => {
      if (multiple) {
        // Multi-select: add to selection and switch to library tab
        setLocalSelection(prev => [...prev, image.imageId]);
        setActiveTab(0); // Switch to library tab to see the new image
      } else {
        // Single-select: immediately select and close the dialog
        onSelectionChange([image.imageId], [image]);
        onClose();
      }
    },
    [multiple, onSelectionChange, onClose],
  );

  const selectedCount = localSelection.length;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      TransitionProps={{ onEnter: handleDialogEnter }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {title}
          {selectedCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {selectedCount} selected
            </Typography>
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue: number) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Library" />
          <Tab label="Upload New" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {activeTab === 0 ? (
            <>
              {/* Search and Tag Filter */}
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField
                  placeholder="Search images..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: search && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearch('')}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TagFilterSelect
                  value={selectedTags}
                  onChange={setSelectedTags}
                  tags={allTags}
                  size="small"
                  minWidth={150}
                />
              </Stack>

              {/* Image Grid */}
              {isLoading ? (
                <Grid container spacing={1}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Grid item xs={6} sm={4} md={3} key={i}>
                      <Skeleton variant="rectangular" height={130} />
                    </Grid>
                  ))}
                </Grid>
              ) : images.length === 0 ? (
                <Box
                  sx={{
                    py: 6,
                    textAlign: 'center',
                  }}
                >
                  <AddPhotoAlternateIcon
                    sx={{ fontSize: 48, color: 'grey.300', mb: 1 }}
                  />
                  <Typography color="text.secondary">
                    {search ? 'No images found' : 'No images in library'}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mb: 2 }}
                  >
                    {search
                      ? 'Try a different search term'
                      : 'Upload your first image to get started'}
                  </Typography>
                  {!search && (
                    <Button
                      variant="outlined"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => setActiveTab(1)}
                    >
                      Upload Image
                    </Button>
                  )}
                </Box>
              ) : (
                <>
                  <Grid container spacing={1}>
                    {images.map(image => (
                      <Grid item xs={6} sm={4} md={3} key={image.id}>
                        <ImageSelectionCard
                          id={image.id}
                          name={image.name}
                          thumbnailUrl={image.thumbnailUrl}
                          imageUrl={image.imageUrl}
                          isSelected={localSelection.includes(image.id)}
                          onToggle={handleToggle}
                          multiple={multiple}
                        />
                      </Grid>
                    ))}
                  </Grid>

                  {/* Load More */}
                  {hasNextPage && (
                    <Box
                      sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}
                    >
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => void fetchNextPage()}
                        disabled={isFetchingNextPage}
                        startIcon={
                          isFetchingNextPage ? (
                            <CircularProgress size={14} />
                          ) : undefined
                        }
                      >
                        {isFetchingNextPage ? 'Loading...' : 'Load More'}
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </>
          ) : (
            /* Upload Tab */
            <UploadPanel
              onUploadSuccess={handleUploadSuccess}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              uploadRef={uploadPanelRef}
              onCanUploadChange={setCanUpload}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {activeTab === 0 ? (
          /* Library Tab Actions */
          <>
            {selectedCount > 0 && (
              <Button onClick={handleClear} color="inherit">
                Clear Selection
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button onClick={handleCancel}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>
              {multiple
                ? `Select ${selectedCount > 0 ? `(${selectedCount})` : ''}`
                : 'Select'}
            </Button>
          </>
        ) : (
          /* Upload Tab Actions */
          <>
            <Box sx={{ flexGrow: 1 }} />
            <Button onClick={handleCancel} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void uploadPanelRef.current?.upload()}
              disabled={!canUpload}
              startIcon={
                isUploading ? (
                  <CircularProgress size={16} />
                ) : (
                  <CloudUploadIcon />
                )
              }
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Compact Image Display Component
// ============================================================================

export type SelectedImagesDisplayProps = {
  /** Array of linked images */
  images: LinkedImage[];
  /** Callback to open the image picker */
  onOpenPicker: () => void;
  /** Callback to remove an image */
  onRemove?: (imageId: string) => void;
  /** Maximum images to display before showing "+N more" */
  maxDisplay?: number;
  /** Size of image thumbnails */
  size?: 'small' | 'medium';
};

export function SelectedImagesDisplay({
  images,
  onOpenPicker,
  onRemove,
  maxDisplay = 4,
  size = 'medium',
}: SelectedImagesDisplayProps): React.ReactElement {
  const imageSize = size === 'small' ? 48 : 64;
  const displayImages = images.slice(0, maxDisplay);
  const remainingCount = images.length - maxDisplay;

  if (images.length === 0) {
    return (
      <Box
        onClick={onOpenPicker}
        sx={{
          border: '2px dashed',
          borderColor: 'grey.300',
          borderRadius: 1,
          p: 2,
          textAlign: 'center',
          cursor: 'pointer',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'grey.50' },
        }}
      >
        <AddPhotoAlternateIcon sx={{ color: 'grey.400', mb: 0.5 }} />
        <Typography variant="caption" color="text.secondary" display="block">
          Add images
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
    >
      {displayImages.map(image => (
        <Box
          key={image.imageId}
          sx={{
            position: 'relative',
            width: imageSize,
            height: imageSize,
            borderRadius: 1,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            component="img"
            src={image.thumbnailUrl ?? image.imageUrl ?? undefined}
            alt={image.name}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {onRemove && (
            <IconButton
              size="small"
              onClick={() => onRemove(image.imageId)}
              sx={{
                position: 'absolute',
                top: -4,
                right: -4,
                bgcolor: 'background.paper',
                boxShadow: 1,
                p: 0.25,
                '&:hover': { bgcolor: 'error.light', color: 'white' },
              }}
            >
              <ClearIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      ))}

      {remainingCount > 0 && (
        <Box
          sx={{
            width: imageSize,
            height: imageSize,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'grey.100',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            +{remainingCount}
          </Typography>
        </Box>
      )}

      <IconButton
        size="small"
        onClick={onOpenPicker}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderStyle: 'dashed',
        }}
      >
        <AddPhotoAlternateIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
