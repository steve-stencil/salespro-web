/**
 * OfficeMigrationWizard Component Tests
 *
 * Tests for the migration wizard component.
 * Tests rendering, selection, import status, and user interactions.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { OfficeMigrationWizard } from '../components/OfficeMigrationWizard';
import {
  useSourceCount,
  useSourceItems,
  useImportedStatus,
  useImportBatches,
} from '../hooks';

// Mock the hooks module
vi.mock('../hooks', () => ({
  useSourceCount: vi.fn(),
  useSourceItems: vi.fn(),
  useImportedStatus: vi.fn(),
  useImportBatches: vi.fn(),
}));

// Create a test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// Default mock implementations
const defaultSourceCountMock = {
  data: 3,
  isLoading: false,
  error: null,
};

const defaultSourceItemsMock = {
  data: {
    data: [
      { objectId: 'office1', name: 'Office 1' },
      { objectId: 'office2', name: 'Office 2' },
      { objectId: 'office3', name: 'Office 3' },
    ],
    meta: { total: 3, skip: 0, limit: 100 },
  },
  isLoading: false,
  error: null,
};

const defaultImportedStatusMock = {
  data: [] as string[], // No offices imported yet
  isLoading: false,
  error: null,
};

const defaultImportBatchesMock = {
  isImporting: false,
  progress: 0,
  session: null,
  importedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  totalCount: 0,
  errors: [],
  importError: null,
  hasFailed: false,
  isComplete: false,
  startImport: vi.fn(),
  startSelectiveImport: vi.fn(),
  reset: vi.fn(),
};

describe('OfficeMigrationWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSourceCount).mockReturnValue(
      defaultSourceCountMock as ReturnType<typeof useSourceCount>,
    );
    vi.mocked(useSourceItems).mockReturnValue(
      defaultSourceItemsMock as ReturnType<typeof useSourceItems>,
    );
    vi.mocked(useImportedStatus).mockReturnValue(
      defaultImportedStatusMock as ReturnType<typeof useImportedStatus>,
    );
    vi.mocked(useImportBatches).mockReturnValue(defaultImportBatchesMock);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Preview Step', () => {
    it('should render the preview step with source offices', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByText('Import Offices')).toBeInTheDocument();
      expect(screen.getByText('Select Offices to Import')).toBeInTheDocument();
      expect(screen.getByText('Office 1')).toBeInTheDocument();
      expect(screen.getByText('Office 2')).toBeInTheDocument();
      expect(screen.getByText('Office 3')).toBeInTheDocument();
    });

    it('should display source count and imported count', () => {
      vi.mocked(useImportedStatus).mockReturnValue({
        ...defaultImportedStatusMock,
        data: ['office1'], // 1 already imported
      } as ReturnType<typeof useImportedStatus>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Should show info about found offices and already imported count
      expect(screen.getByText(/Found/)).toBeInTheDocument();
      expect(screen.getByText(/already imported/)).toBeInTheDocument();
    });

    it('should show loading state', () => {
      vi.mocked(useSourceCount).mockReturnValue({
        ...defaultSourceCountMock,
        isLoading: true,
        data: undefined,
      } as ReturnType<typeof useSourceCount>);
      vi.mocked(useSourceItems).mockReturnValue({
        ...defaultSourceItemsMock,
        isLoading: true,
        data: undefined,
      } as ReturnType<typeof useSourceItems>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Should show loading spinner (MUI CircularProgress)
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display fetch error when source count fails', () => {
      const error = new Error('Source database unavailable');
      vi.mocked(useSourceCount).mockReturnValue({
        ...defaultSourceCountMock,
        error,
        data: undefined,
      } as ReturnType<typeof useSourceCount>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(
        screen.getByText('Failed to load source data'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Source database unavailable'),
      ).toBeInTheDocument();
    });

    it('should show checkboxes for selecting offices', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Should have checkboxes (1 for header + 3 for offices)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4);
    });

    it('should show Imported chip for already imported offices', () => {
      vi.mocked(useImportedStatus).mockReturnValue({
        ...defaultImportedStatusMock,
        data: ['office1', 'office3'], // 2 already imported
      } as ReturnType<typeof useImportedStatus>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Should show 2 "Imported" chips
      const importedChips = screen.getAllByText('Imported');
      expect(importedChips.length).toBe(2);
    });

    it('should disable checkbox for already imported offices', () => {
      vi.mocked(useImportedStatus).mockReturnValue({
        ...defaultImportedStatusMock,
        data: ['office1'], // 1 already imported
      } as ReturnType<typeof useImportedStatus>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // Header checkbox + 3 office checkboxes
      // office1 should be disabled
      const disabledCheckboxes = checkboxes.filter(
        cb => (cb as HTMLInputElement).disabled,
      );
      expect(disabledCheckboxes.length).toBe(1);
    });

    it('should select/deselect offices when clicking checkbox', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is header, skip it
      const office1Checkbox = checkboxes[1]!;

      // Initially not checked
      expect(office1Checkbox).not.toBeChecked();

      // Click to select
      fireEvent.click(office1Checkbox);
      expect(office1Checkbox).toBeChecked();

      // Click again to deselect
      fireEvent.click(office1Checkbox);
      expect(office1Checkbox).not.toBeChecked();
    });

    it('should select all available offices with header checkbox', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0]!;

      // Click header to select all
      fireEvent.click(headerCheckbox);

      // All office checkboxes should be checked
      const officeCheckboxes = checkboxes.slice(1);
      officeCheckboxes.forEach(cb => {
        expect(cb).toBeChecked();
      });
    });

    it('should call onCancel when Cancel button is clicked', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should disable Import button when no offices selected', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Button text shows count of selected items
      const importButton = screen.getByRole('button', {
        name: /Import 0 Office/,
      });
      expect(importButton).toBeDisabled();
    });

    it('should enable Import button when offices are selected', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select an office
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);

      const importButton = screen.getByRole('button', {
        name: /Import 1 Office/,
      });
      expect(importButton).not.toBeDisabled();
    });
  });

  describe('Import Step', () => {
    it('should show importing progress', () => {
      vi.mocked(useImportBatches).mockReturnValue({
        ...defaultImportBatchesMock,
        isImporting: true,
        progress: 50,
        totalCount: 10,
        importedCount: 5,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select an office first
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);

      // Trigger import step
      fireEvent.click(screen.getByRole('button', { name: /Import 1 Office/ }));

      // After clicking, the component moves to step 1 (Import)
      expect(screen.getByText('Importing offices...')).toBeInTheDocument();
    });

    it('should call startSelectiveImport with selected IDs', () => {
      const mockStartSelectiveImport = vi.fn();
      vi.mocked(useImportBatches).mockReturnValue({
        ...defaultImportBatchesMock,
        startSelectiveImport: mockStartSelectiveImport,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select office1 and office2
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!); // office1
      fireEvent.click(checkboxes[2]!); // office2

      // Click import
      fireEvent.click(screen.getByRole('button', { name: /Import 2 Office/ }));

      expect(mockStartSelectiveImport).toHaveBeenCalledWith([
        'office1',
        'office2',
      ]);
    });

    it('should show completed state with success', () => {
      vi.mocked(useImportBatches).mockReturnValue({
        ...defaultImportBatchesMock,
        isComplete: true,
        session: {
          id: 'session-123',
          status: 'completed',
          totalCount: 3,
          importedCount: 3,
          skippedCount: 0,
          errorCount: 0,
          createdAt: new Date().toISOString(),
        },
        importedCount: 3,
        totalCount: 3,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select and trigger import
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);
      fireEvent.click(screen.getByRole('button', { name: /Import 1 Office/ }));

      expect(
        screen.getByText('Import completed successfully!'),
      ).toBeInTheDocument();
      // Verify the imported count is shown in the stats area
      expect(screen.getByRole('heading', { name: '3' })).toBeInTheDocument();
    });

    it('should show import failed state with error message', () => {
      vi.mocked(useImportBatches).mockReturnValue({
        ...defaultImportBatchesMock,
        hasFailed: true,
        importError: 'Source company not found in legacy system',
        session: {
          id: '',
          status: 'failed',
          totalCount: 0,
          importedCount: 0,
          skippedCount: 0,
          errorCount: 0,
          createdAt: new Date().toISOString(),
        },
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select and trigger import
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);
      fireEvent.click(screen.getByRole('button', { name: /Import 1 Office/ }));

      expect(screen.getByText('Import Failed')).toBeInTheDocument();
      expect(
        screen.getByText('Source company not found in legacy system'),
      ).toBeInTheDocument();
    });

    it('should call reset when Try Again is clicked after failure', () => {
      const mockReset = vi.fn();
      vi.mocked(useImportBatches).mockReturnValue({
        ...defaultImportBatchesMock,
        hasFailed: true,
        importError: 'Failed',
        reset: mockReset,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select and trigger import
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);
      fireEvent.click(screen.getByRole('button', { name: /Import 1 Office/ }));

      // Click Try Again
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

      expect(mockReset).toHaveBeenCalled();
    });

    it('should call onComplete when Done is clicked after success', () => {
      vi.mocked(useImportBatches).mockReturnValue({
        ...defaultImportBatchesMock,
        isComplete: true,
        importedCount: 3,
        session: {
          id: 'session-123',
          status: 'completed',
          totalCount: 3,
          importedCount: 3,
          skippedCount: 0,
          errorCount: 0,
          createdAt: new Date().toISOString(),
        },
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select and trigger import
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);
      fireEvent.click(screen.getByRole('button', { name: /Import 1 Office/ }));

      // Click Done
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it('should show errors table when there are import errors', () => {
      vi.mocked(useImportBatches).mockReturnValue({
        ...defaultImportBatchesMock,
        isComplete: true,
        errorCount: 2,
        errors: [
          { sourceId: 'office1', error: 'Duplicate entry' },
          { sourceId: 'office2', error: 'Invalid data' },
        ],
        session: {
          id: 'session-123',
          status: 'completed',
          totalCount: 5,
          importedCount: 3,
          skippedCount: 0,
          errorCount: 2,
          createdAt: new Date().toISOString(),
        },
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Select and trigger import
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);
      fireEvent.click(screen.getByRole('button', { name: /Import 1 Office/ }));

      expect(screen.getByText('Error Details')).toBeInTheDocument();
      expect(screen.getByText('Duplicate entry')).toBeInTheDocument();
      expect(screen.getByText('Invalid data')).toBeInTheDocument();
    });
  });

  describe('Error message extraction', () => {
    it('should extract message from axios error response', () => {
      // Axios-style error with response.data.message
      const axiosError = {
        response: {
          data: {
            message: 'Custom error from server',
          },
        },
      };
      vi.mocked(useSourceItems).mockReturnValue({
        ...defaultSourceItemsMock,
        error: axiosError,
        data: undefined,
      } as unknown as ReturnType<typeof useSourceItems>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByText('Custom error from server')).toBeInTheDocument();
    });

    it('should extract error property from axios error response', () => {
      // Axios-style error with response.data.error
      const axiosError = {
        response: {
          data: {
            error: 'Error property message',
          },
        },
      };
      vi.mocked(useSourceItems).mockReturnValue({
        ...defaultSourceItemsMock,
        error: axiosError,
        data: undefined,
      } as unknown as ReturnType<typeof useSourceItems>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <OfficeMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByText('Error property message')).toBeInTheDocument();
    });
  });
});
