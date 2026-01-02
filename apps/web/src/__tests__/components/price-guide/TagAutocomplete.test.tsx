/**
 * Tests for TagAutocomplete component.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { TagAutocomplete } from '../../../components/price-guide/TagAutocomplete';

import type { TagSummary } from '@shared/types';

// ============================================================================
// Test Data
// ============================================================================

const mockTags: TagSummary[] = [
  { id: 'tag-1', name: 'Premium', color: '#1976D2' },
  { id: 'tag-2', name: 'Sale', color: '#FFEB3B' },
  { id: 'tag-3', name: 'New', color: '#4CAF50' },
];

// ============================================================================
// Tests
// ============================================================================

describe('TagAutocomplete', () => {
  it('should render with placeholder', () => {
    render(
      <TagAutocomplete value={[]} onChange={vi.fn()} options={mockTags} />,
    );

    expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
  });

  it('should render with custom placeholder', () => {
    render(
      <TagAutocomplete
        value={[]}
        onChange={vi.fn()}
        options={mockTags}
        placeholder="Select tags..."
      />,
    );

    expect(screen.getByPlaceholderText('Select tags...')).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(
      <TagAutocomplete
        value={[]}
        onChange={vi.fn()}
        options={mockTags}
        label="Tags"
      />,
    );

    expect(screen.getByLabelText('Tags')).toBeInTheDocument();
  });

  it('should display selected tags as chips', () => {
    render(
      <TagAutocomplete
        value={[mockTags[0]!, mockTags[1]!]}
        onChange={vi.fn()}
        options={mockTags}
      />,
    );

    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Sale')).toBeInTheDocument();
  });

  it('should show dropdown options when focused', async () => {
    const user = userEvent.setup();
    render(
      <TagAutocomplete value={[]} onChange={vi.fn()} options={mockTags} />,
    );

    const input = screen.getByRole('combobox');
    await user.click(input);

    // Check dropdown shows options
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Sale')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should filter options based on input', async () => {
    const user = userEvent.setup();
    render(
      <TagAutocomplete value={[]} onChange={vi.fn()} options={mockTags} />,
    );

    const input = screen.getByRole('combobox');
    await user.type(input, 'Prem');

    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.queryByText('Sale')).not.toBeInTheDocument();
    });
  });

  it('should call onChange when tag is selected', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TagAutocomplete value={[]} onChange={handleChange} options={mockTags} />,
    );

    const input = screen.getByRole('combobox');
    await user.click(input);

    const premiumOption = screen.getByText('Premium');
    await user.click(premiumOption);

    expect(handleChange).toHaveBeenCalledWith([mockTags[0]]);
  });

  it('should call onChange when tag is removed', () => {
    const handleChange = vi.fn();
    render(
      <TagAutocomplete
        value={[mockTags[0]!]}
        onChange={handleChange}
        options={mockTags}
      />,
    );

    // Find and click the delete button on the chip
    const deleteButton = screen.getByTestId('CancelIcon');
    fireEvent.click(deleteButton);

    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('should hide already selected tags from dropdown', async () => {
    const user = userEvent.setup();
    render(
      <TagAutocomplete
        value={[mockTags[0]!]}
        onChange={vi.fn()}
        options={mockTags}
      />,
    );

    const input = screen.getByRole('combobox');
    await user.click(input);

    // Premium should not be in the dropdown since it's already selected
    const listbox = screen.getByRole('listbox');
    expect(listbox).not.toHaveTextContent('Premium');
    expect(listbox).toHaveTextContent('Sale');
    expect(listbox).toHaveTextContent('New');
  });

  it('should call onInputChange when typing', async () => {
    const handleInputChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TagAutocomplete
        value={[]}
        onChange={vi.fn()}
        options={mockTags}
        onInputChange={handleInputChange}
      />,
    );

    const input = screen.getByRole('combobox');
    await user.type(input, 'test');

    expect(handleInputChange).toHaveBeenCalledWith('test');
  });

  it('should show loading indicator when loading', () => {
    render(
      <TagAutocomplete
        value={[]}
        onChange={vi.fn()}
        options={mockTags}
        loading
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <TagAutocomplete
        value={[]}
        onChange={vi.fn()}
        options={mockTags}
        disabled
      />,
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('should show error state', () => {
    const { container } = render(
      <TagAutocomplete
        value={[]}
        onChange={vi.fn()}
        options={mockTags}
        error
        helperText="Tags are required"
      />,
    );

    expect(screen.getByText('Tags are required')).toBeInTheDocument();
    expect(container.querySelector('.Mui-error')).toBeInTheDocument();
  });

  describe('Tag Creation', () => {
    it('should show "Create" option when input does not match any tag', async () => {
      const user = userEvent.setup();
      const handleCreate = vi.fn();

      render(
        <TagAutocomplete
          value={[]}
          onChange={vi.fn()}
          options={mockTags}
          onCreateTag={handleCreate}
        />,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'Custom');

      await waitFor(() => {
        // Text is split across elements, so check separately
        expect(screen.getByText(/Create tag/)).toBeInTheDocument();
        // The tag name appears in a <strong> element
        expect(screen.getByText('Custom')).toBeInTheDocument();
      });
    });

    it('should not show "Create" option when input matches existing tag', async () => {
      const user = userEvent.setup();
      const handleCreate = vi.fn();

      render(
        <TagAutocomplete
          value={[]}
          onChange={vi.fn()}
          options={mockTags}
          onCreateTag={handleCreate}
        />,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'Premium');

      await waitFor(() => {
        expect(screen.queryByText(/Create tag/)).not.toBeInTheDocument();
      });
    });

    it('should not show "Create" option when onCreateTag is not provided', async () => {
      const user = userEvent.setup();

      render(
        <TagAutocomplete value={[]} onChange={vi.fn()} options={mockTags} />,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'Custom');

      await waitFor(() => {
        expect(screen.queryByText(/Create tag/)).not.toBeInTheDocument();
      });
    });

    it('should call onCreateTag when "Create" option is clicked', async () => {
      const user = userEvent.setup();
      const newTag: TagSummary = {
        id: 'new-tag',
        name: 'Custom',
        color: '#FF0000',
      };
      const handleCreate = vi.fn().mockResolvedValue(newTag);
      const handleChange = vi.fn();

      render(
        <TagAutocomplete
          value={[]}
          onChange={handleChange}
          options={mockTags}
          onCreateTag={handleCreate}
        />,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'Custom');

      await waitFor(() => {
        expect(screen.getByText(/Create tag/)).toBeInTheDocument();
      });

      const createOption = screen.getByText(/Create tag/).closest('li');
      if (createOption) {
        await user.click(createOption);
      }

      await waitFor(() => {
        expect(handleCreate).toHaveBeenCalledWith('Custom');
        expect(handleChange).toHaveBeenCalledWith([newTag]);
      });
    });
  });
});
