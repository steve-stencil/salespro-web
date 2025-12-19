/**
 * Inline edit input component for quick renaming.
 * Double-click to edit, Enter to save, Escape to cancel.
 */
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';

type InlineEditInputProps = {
  /** Current value to display. */
  value: string;
  /** Callback when value is saved. */
  onSave: (value: string) => void;
  /** Callback when editing is cancelled. */
  onCancel?: () => void;
  /** Typography variant for display mode. */
  variant?: 'body1' | 'body2' | 'h6' | 'subtitle1';
  /** Whether editing is disabled. */
  disabled?: boolean;
  /** Placeholder text when editing. */
  placeholder?: string;
};

/**
 * Inline text edit component.
 * Shows text normally, switches to input on double-click.
 */
export function InlineEditInput({
  value,
  onSave,
  onCancel,
  variant = 'body1',
  disabled = false,
  placeholder = 'Enter name...',
}: InlineEditInputProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleDoubleClick(): void {
    if (!disabled) {
      setIsEditing(true);
    }
  }

  function handleSave(): void {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  }

  function handleCancel(): void {
    setEditValue(value);
    setIsEditing(false);
    onCancel?.();
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }

  function handleBlur(): void {
    handleSave();
  }

  if (isEditing) {
    return (
      <TextField
        inputRef={inputRef}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        size="small"
        variant="outlined"
        fullWidth
        slotProps={{
          input: {
            sx: {
              py: 0.25,
              px: 1,
              fontSize: variant === 'h6' ? '1.25rem' : 'inherit',
            },
          },
        }}
      />
    );
  }

  return (
    <Box
      onDoubleClick={handleDoubleClick}
      sx={{
        cursor: disabled ? 'default' : 'pointer',
        '&:hover': disabled
          ? {}
          : {
              backgroundColor: 'action.hover',
              borderRadius: 0.5,
            },
        px: 0.5,
        py: 0.25,
        mx: -0.5,
        borderRadius: 0.5,
      }}
      title={disabled ? undefined : 'Double-click to edit'}
    >
      <Typography
        variant={variant}
        sx={{
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
