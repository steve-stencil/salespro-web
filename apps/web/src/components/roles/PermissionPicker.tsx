/**
 * Permission picker component.
 * Displays permissions grouped by category with checkboxes.
 */
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { usePermissions } from '../../hooks/useRoles';

interface PermissionPickerProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
}

/**
 * Component for selecting permissions grouped by category.
 */
export function PermissionPicker({
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionPickerProps): React.ReactElement {
  const { data: permissionsData, isLoading } = usePermissions();

  /**
   * Handle permission toggle.
   */
  function handleToggle(permission: string): void {
    const newPermissions = selectedPermissions.includes(permission)
      ? selectedPermissions.filter(p => p !== permission)
      : [...selectedPermissions, permission];
    onChange(newPermissions);
  }

  /**
   * Handle toggling all permissions in a category.
   */
  function handleToggleCategory(
    categoryPermissions: string[],
    checked: boolean,
  ): void {
    if (checked) {
      // Add all category permissions
      const newPermissions = new Set([
        ...selectedPermissions,
        ...categoryPermissions,
      ]);
      onChange(Array.from(newPermissions));
    } else {
      // Remove all category permissions
      const categorySet = new Set(categoryPermissions);
      onChange(selectedPermissions.filter(p => !categorySet.has(p)));
    }
  }

  /**
   * Check if all permissions in a category are selected.
   */
  function isAllSelected(categoryPermissions: string[]): boolean {
    return categoryPermissions.every(p => selectedPermissions.includes(p));
  }

  /**
   * Check if some (but not all) permissions in a category are selected.
   */
  function isSomeSelected(categoryPermissions: string[]): boolean {
    const count = categoryPermissions.filter(p =>
      selectedPermissions.includes(p),
    ).length;
    return count > 0 && count < categoryPermissions.length;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!permissionsData) {
    return (
      <Typography color="text.secondary">
        Unable to load permissions.
      </Typography>
    );
  }

  // Get permission metadata for descriptions
  const permissionMeta = new Map(
    permissionsData.permissions.map(p => [p.name, p]),
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(permissionsData.byCategory).map(
        ([category, permissions]) => {
          const allSelected = isAllSelected(permissions);
          const someSelected = isSomeSelected(permissions);

          return (
            <Paper key={category} variant="outlined" sx={{ p: 2 }}>
              {/* Category Header */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={e =>
                      handleToggleCategory(permissions, e.target.checked)
                    }
                    disabled={disabled}
                  />
                }
                label={
                  <Typography variant="subtitle2" fontWeight={600}>
                    {category}
                  </Typography>
                }
                sx={{ mb: 1 }}
              />

              {/* Permission Checkboxes */}
              <FormGroup sx={{ pl: 3 }}>
                {permissions.map(permission => {
                  const meta = permissionMeta.get(permission);
                  return (
                    <FormControlLabel
                      key={permission}
                      control={
                        <Checkbox
                          checked={selectedPermissions.includes(permission)}
                          onChange={() => handleToggle(permission)}
                          disabled={disabled}
                          size="small"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            {meta?.label ?? permission}
                          </Typography>
                          {meta?.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {meta.description}
                            </Typography>
                          )}
                        </Box>
                      }
                      sx={{ mb: 0.5, alignItems: 'flex-start' }}
                    />
                  );
                })}
              </FormGroup>
            </Paper>
          );
        },
      )}
    </Box>
  );
}
