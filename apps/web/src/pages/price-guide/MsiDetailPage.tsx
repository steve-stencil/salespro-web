/**
 * MSI Detail Page.
 * Displays full details of a Measure Sheet Item with actions.
 */

import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { DeleteMsiDialog } from '../../components/price-guide/DeleteMsiDialog';
import { DuplicateMsiDialog } from '../../components/price-guide/DuplicateMsiDialog';
import { useMsiDetail } from '../../hooks/usePriceGuide';

// ============================================================================
// Constants
// ============================================================================

const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  each: 'Each',
  sqft: 'Square Feet',
  linear_ft: 'Linear Feet',
  united_inches: 'United Inches',
  pair: 'Pair',
};

const INPUT_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  picker: 'Picker',
  date: 'Date',
  toggle: 'Toggle',
};

// ============================================================================
// Main Component
// ============================================================================

export function MsiDetailPage(): React.ReactElement {
  const { msiId } = useParams<{ msiId: string }>();
  const navigate = useNavigate();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // Query
  const { data, isLoading, error } = useMsiDetail(msiId ?? '');

  // Handlers
  const handleEdit = useCallback(() => {
    void navigate(`/price-guide/${msiId}/edit`);
  }, [navigate, msiId]);

  const handlePricing = useCallback(() => {
    void navigate(`/price-guide/${msiId}/pricing`);
  }, [navigate, msiId]);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteDialogOpen(false);
    void navigate('/price-guide');
  }, [navigate]);

  const handleDuplicateSuccess = useCallback(
    (newMsiId: string) => {
      setDuplicateDialogOpen(false);
      void navigate(`/price-guide/${newMsiId}`);
    },
    [navigate],
  );

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component={RouterLink}
            to="/price-guide"
            underline="hover"
            color="inherit"
          >
            Price Guide
          </Link>
          <Typography color="text.primary">Item Not Found</Typography>
        </Breadcrumbs>
        <Typography color="error">
          Failed to load item details. The item may have been deleted or you may
          not have permission to view it.
        </Typography>
        <Button
          component={RouterLink}
          to="/price-guide"
          variant="outlined"
          sx={{ mt: 2 }}
        >
          Back to Price Guide
        </Button>
      </Box>
    );
  }

  const msi = data.item;

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component={RouterLink}
          to="/price-guide"
          underline="hover"
          color="inherit"
        >
          Price Guide
        </Link>
        <Link
          component={RouterLink}
          to={`/price-guide?category=${msi.category.id}`}
          underline="hover"
          color="inherit"
        >
          {msi.category.name}
        </Link>
        <Typography color="text.primary">{msi.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h2" component="h1" gutterBottom>
            {msi.name}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={
                MEASUREMENT_TYPE_LABELS[msi.measurementType] ??
                msi.measurementType
              }
              size="small"
              color="primary"
              variant="outlined"
            />
            <Typography variant="body2" color="text.secondary">
              {msi.category.fullPath}
            </Typography>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AttachMoneyIcon />}
            onClick={handlePricing}
          >
            Pricing
          </Button>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => setDuplicateDialogOpen(true)}
          >
            Duplicate
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Basic Info */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Basic Information */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Default Quantity
                  </Typography>
                  <Typography variant="body1">{msi.defaultQty}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Show Switch
                  </Typography>
                  <Typography variant="body1">
                    {msi.showSwitch ? 'Yes' : 'No'}
                  </Typography>
                </Grid>
                {msi.note && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Note
                    </Typography>
                    <Typography variant="body1">{msi.note}</Typography>
                  </Grid>
                )}
                {msi.tagTitle && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Tag Title
                      </Typography>
                      <Typography variant="body1">{msi.tagTitle}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Tag Required
                      </Typography>
                      <Typography variant="body1">
                        {msi.tagRequired ? 'Yes' : 'No'}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Linked Items */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Linked Items
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Options */}
              <Accordion defaultExpanded={msi.options.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={500}>
                    Options ({msi.options.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {msi.options.length === 0 ? (
                    <Typography color="text.secondary">
                      No options linked
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {msi.options.map(option => (
                        <ListItem key={option.junctionId} disableGutters>
                          <ListItemText
                            primary={option.name}
                            secondary={option.brand ?? option.itemCode}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* UpCharges */}
              <Accordion defaultExpanded={msi.upcharges.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={500}>
                    UpCharges ({msi.upcharges.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {msi.upcharges.length === 0 ? (
                    <Typography color="text.secondary">
                      No upcharges linked
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {msi.upcharges.map(upcharge => (
                        <ListItem key={upcharge.junctionId} disableGutters>
                          <ListItemText
                            primary={upcharge.name}
                            secondary={upcharge.note}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Additional Details */}
              <Accordion defaultExpanded={msi.additionalDetails.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={500}>
                    Additional Details ({msi.additionalDetails.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {msi.additionalDetails.length === 0 ? (
                    <Typography color="text.secondary">
                      No additional details linked
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {msi.additionalDetails.map(detail => (
                        <ListItem key={detail.junctionId} disableGutters>
                          <ListItemText
                            primary={detail.title}
                            secondary={
                              INPUT_TYPE_LABELS[detail.inputType] ??
                              detail.inputType
                            }
                          />
                          {detail.isRequired && (
                            <Chip
                              label="Required"
                              size="small"
                              color="warning"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Offices & Metadata */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Offices */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Offices ({msi.offices.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={0.5}>
                {msi.offices.map(office => (
                  <Chip
                    key={office.id}
                    label={office.name}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Metadata
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Version
                  </Typography>
                  <Typography variant="body2">{msi.version}</Typography>
                </Box>
                {msi.lastModifiedBy && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Last Modified By
                    </Typography>
                    <Typography variant="body2">
                      {msi.lastModifiedBy.name}
                    </Typography>
                  </Box>
                )}
                {msi.lastModifiedAt && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Last Modified
                    </Typography>
                    <Typography variant="body2">
                      {new Date(msi.lastModifiedAt).toLocaleString()}
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body2">
                    <Chip
                      label={msi.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={msi.isActive ? 'success' : 'default'}
                    />
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialogs */}
      <DeleteMsiDialog
        open={deleteDialogOpen}
        msiId={msiId ?? ''}
        msiName={msi.name}
        onClose={() => setDeleteDialogOpen(false)}
        onSuccess={handleDeleteSuccess}
      />

      <DuplicateMsiDialog
        open={duplicateDialogOpen}
        msi={msi}
        onClose={() => setDuplicateDialogOpen(false)}
        onSuccess={handleDuplicateSuccess}
      />
    </Box>
  );
}
