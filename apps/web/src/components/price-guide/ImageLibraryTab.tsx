/**
 * Image Library Tab Component.
 * Displays and manages shared images in the Price Guide library.
 */

import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  useImageList,
  useImageDetail,
  useUploadImage,
  useUpdateImage,
  useDeleteImage,
  useImageWhereUsed,
  priceGuideKeys,
} from '../../hooks/usePriceGuide';
import { useTagList, useSetItemTags } from '../../hooks/useTags';

import { ItemTagEditor } from './ItemTagEditor';
import { TagAutocomplete } from './TagAutocomplete';
import { TagDots } from './TagDots';
import { UsageIcons } from './UsageIcons';

import type { PriceGuideImageSummary, TagSummary } from '@shared/types';

// ============================================================================
// Types
// ============================================================================

type ImageLibraryTabProps = {
  /** Initial search query */
  search?: string;
  /** Tag IDs to filter by */
  tags?: string[];
};

// ============================================================================
// Upload Image Dialog
// ============================================================================

type UploadImageDialogProps = {
  open: boolean;
  onClose: () => void;
  isLoading: boolean;
};

function UploadImageDialog({
  open,
  onClose,
  isLoading,
}: UploadImageDialogProps): React.ReactElement {
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

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;

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
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setFile(null);
    setPreview(null);
    setError(null);
    setSelectedTags([]);
    setIsDragOver(false);
    onClose();
  };

  const handleTagsChange = useCallback((newTags: TagSummary[]) => {
    setSelectedTags(newTags);
  }, []);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload New Image</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* File Input */}
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
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
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
              <AddPhotoAlternateIcon
                sx={{
                  fontSize: 48,
                  color: isDragOver ? 'primary.main' : 'grey.400',
                  mb: 1,
                }}
              />
              <Typography
                color={isDragOver ? 'primary.main' : 'text.secondary'}
              >
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
          />

          <TextField
            label="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
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
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={isLoading || uploadMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={
            !file || !name.trim() || isLoading || uploadMutation.isPending
          }
          startIcon={
            uploadMutation.isPending ? (
              <CircularProgress size={16} />
            ) : (
              <AddPhotoAlternateIcon />
            )
          }
        >
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Edit Image Dialog
// ============================================================================

type EditImageDialogProps = {
  open: boolean;
  imageId: string | null;
  onClose: () => void;
  isLoading: boolean;
};

function EditImageDialog({
  open,
  imageId,
  onClose,
  isLoading,
}: EditImageDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { data: imageData, isLoading: isLoadingDetail } = useImageDetail(
    imageId ?? '',
  );
  const updateMutation = useUpdateImage();
  const queryClient = useQueryClient();

  // Sync form state when image data loads
  useEffect(() => {
    if (imageData?.item) {
      setName(imageData.item.name);
      setDescription(imageData.item.description ?? '');
      setVersion(imageData.item.version);
    }
  }, [imageData]);

  const handleSubmit = async () => {
    if (!name.trim() || !imageId) return;

    try {
      await updateMutation.mutateAsync({
        imageId,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          version,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: priceGuideKeys.imageLists(),
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image');
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Image</DialogTitle>
      <DialogContent>
        {isLoadingDetail ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {imageData?.item.thumbnailUrl && (
              <Box
                component="img"
                src={imageData.item.thumbnailUrl}
                alt={imageData.item.name}
                sx={{
                  width: '100%',
                  maxHeight: 150,
                  objectFit: 'contain',
                  borderRadius: 1,
                  bgcolor: 'grey.100',
                }}
              />
            )}

            <TextField
              label="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              required
              autoFocus
            />

            <TextField
              label="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            {/* Tags Section */}
            {imageId && (
              <>
                <Divider sx={{ my: 1 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Tags
                  </Typography>
                  <ItemTagEditor
                    entityType="PRICE_GUIDE_IMAGE"
                    entityId={imageId}
                    label="Tags"
                    placeholder="Add tags..."
                  />
                </Box>
              </>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || isLoading || isLoadingDetail}
          startIcon={isLoading ? <CircularProgress size={16} /> : <EditIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

type DeleteImageDialogProps = {
  open: boolean;
  imageId: string | null;
  imageName: string;
  onClose: () => void;
  onConfirm: (force: boolean) => void;
  isLoading: boolean;
};

function DeleteImageDialog({
  open,
  imageId,
  imageName,
  onClose,
  onConfirm,
  isLoading,
}: DeleteImageDialogProps): React.ReactElement {
  const { data: whereUsed, isLoading: isLoadingWhereUsed } = useImageWhereUsed(
    imageId ?? '',
  );

  const totalUsage =
    (whereUsed?.msis.length ?? 0) + (whereUsed?.upcharges.length ?? 0);
  const hasUsage = totalUsage > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Image</DialogTitle>
      <DialogContent>
        {isLoadingWhereUsed ? (
          <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : hasUsage ? (
          <Stack spacing={2}>
            <Alert severity="warning">
              This image is used by {whereUsed?.msis.length ?? 0} MSI(s) and{' '}
              {whereUsed?.upcharges.length ?? 0} UpCharge(s). Deleting it will
              remove it from all linked items.
            </Alert>
            <Typography>
              Are you sure you want to delete <strong>{imageName}</strong>?
            </Typography>
            {(whereUsed?.msis.length ?? 0) > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Used by MSIs:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {whereUsed?.msis.slice(0, 10).map(msi => (
                    <Chip key={msi.id} label={msi.name} size="small" />
                  ))}
                  {(whereUsed?.msis.length ?? 0) > 10 && (
                    <Chip
                      label={`+${(whereUsed?.msis.length ?? 0) - 10} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            )}
            {(whereUsed?.upcharges.length ?? 0) > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Used by UpCharges:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {whereUsed?.upcharges.slice(0, 10).map(uc => (
                    <Chip key={uc.id} label={uc.name} size="small" />
                  ))}
                  {(whereUsed?.upcharges.length ?? 0) > 10 && (
                    <Chip
                      label={`+${(whereUsed?.upcharges.length ?? 0) - 10} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            )}
          </Stack>
        ) : (
          <Typography>
            Are you sure you want to delete <strong>{imageName}</strong>?
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => onConfirm(hasUsage)}
          disabled={isLoading || isLoadingWhereUsed}
          startIcon={
            isLoading ? <CircularProgress size={16} /> : <DeleteIcon />
          }
        >
          {hasUsage ? 'Delete Anyway' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Image Card Component (Compact Layout)
// ============================================================================

type ImageCardProps = {
  image: PriceGuideImageSummary;
  onEdit: (imageId: string) => void;
  onDelete: (imageId: string, name: string) => void;
};

function ImageCard({
  image,
  onEdit,
  onDelete,
}: ImageCardProps): React.ReactElement {
  const hasTags = image.tags && image.tags.length > 0;
  const hasUsage = image.linkedMsiCount > 0 || image.linkedUpchargeCount > 0;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardMedia
        component="img"
        image={image.thumbnailUrl ?? image.imageUrl ?? undefined}
        alt={image.name}
        sx={{
          height: 100,
          width: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          bgcolor: 'grey.100',
        }}
      />
      <Box sx={{ p: 1, flexGrow: 1 }}>
        <Typography
          variant="body2"
          noWrap
          title={image.name}
          sx={{ fontWeight: 600, fontSize: '0.8rem' }}
        >
          {image.name}
        </Typography>
        {/* Compact indicators row: Tags (dots) + Usage (icons) */}
        {(hasTags || hasUsage) && (
          <Box
            sx={{
              mt: 0.75,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            {hasTags ? (
              <TagDots tags={image.tags ?? []} maxDots={5} />
            ) : (
              <Box />
            )}
            <UsageIcons
              msiCount={image.linkedMsiCount}
              upchargeCount={image.linkedUpchargeCount}
            />
          </Box>
        )}
      </Box>
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0, pb: 0.5, px: 0.5 }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(image.id)}>
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => onDelete(image.id, image.name)}
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ImageLibraryTab({
  search: externalSearch,
  tags,
}: ImageLibraryTabProps): React.ReactElement {
  // Use external search from parent (already debounced there)
  const debouncedSearch = useDebouncedValue(externalSearch ?? '', 300);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState('');

  const queryClient = useQueryClient();
  const deleteMutation = useDeleteImage();

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useImageList({
    search: debouncedSearch || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    limit: 24,
  });

  // Flatten pages
  const images = data?.pages.flatMap(page => page.items) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;

  const handleEdit = useCallback((imageId: string) => {
    setSelectedImageId(imageId);
    setShowEditDialog(true);
  }, []);

  const handleDelete = useCallback((imageId: string, name: string) => {
    setSelectedImageId(imageId);
    setSelectedImageName(name);
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = async (force: boolean) => {
    if (!selectedImageId) return;

    try {
      await deleteMutation.mutateAsync({
        imageId: selectedImageId,
        force,
      });
      await queryClient.invalidateQueries({
        queryKey: priceGuideKeys.imageLists(),
      });
      setShowDeleteDialog(false);
      setSelectedImageId(null);
      setSelectedImageName('');
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load images. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header with Upload Button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        {/* Count */}
        <Typography variant="body2" color="text.secondary">
          {isLoading ? (
            <Skeleton width={100} />
          ) : (
            `${totalCount} image${totalCount !== 1 ? 's' : ''}`
          )}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddPhotoAlternateIcon />}
          onClick={() => setShowUploadDialog(true)}
        >
          Upload Image
        </Button>
      </Box>

      {/* Image Grid */}
      {isLoading ? (
        <Grid container spacing={1.5}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={i}>
              <Skeleton
                variant="rectangular"
                height={160}
                sx={{ borderRadius: 1 }}
              />
            </Grid>
          ))}
        </Grid>
      ) : images.length === 0 ? (
        <Box
          sx={{
            py: 8,
            textAlign: 'center',
          }}
        >
          <AddPhotoAlternateIcon
            sx={{ fontSize: 64, color: 'grey.300', mb: 2 }}
          />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {debouncedSearch ? 'No images found' : 'No images yet'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {debouncedSearch
              ? 'Try adjusting your search'
              : 'Upload images to use across your MSIs and UpCharges'}
          </Typography>
          {!debouncedSearch && (
            <Button
              variant="contained"
              startIcon={<AddPhotoAlternateIcon />}
              onClick={() => setShowUploadDialog(true)}
            >
              Upload First Image
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Grid container spacing={1.5}>
            {images.map(image => (
              <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={image.id}>
                <ImageCard
                  image={image}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </Grid>
            ))}
          </Grid>

          {/* Load More */}
          {hasNextPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                startIcon={
                  isFetchingNextPage ? (
                    <CircularProgress size={16} />
                  ) : undefined
                }
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </Button>
            </Box>
          )}
        </>
      )}

      {/* Dialogs */}
      <UploadImageDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        isLoading={false}
      />

      <EditImageDialog
        open={showEditDialog}
        imageId={selectedImageId}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedImageId(null);
        }}
        isLoading={false}
      />

      <DeleteImageDialog
        open={showDeleteDialog}
        imageId={selectedImageId}
        imageName={selectedImageName}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedImageId(null);
          setSelectedImageName('');
        }}
        onConfirm={force => void handleConfirmDelete(force)}
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
}
