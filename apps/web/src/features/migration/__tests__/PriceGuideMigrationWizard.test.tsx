/**
 * PriceGuideMigrationWizard Component Tests
 *
 * Tests for the price guide migration wizard component.
 * Tests rendering, step navigation, configuration, and user interactions.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PriceGuideMigrationWizard } from '../components/PriceGuideMigrationWizard';
import {
  useSourceConnection,
  usePriceGuideSourceCounts,
  useOfficeMappings,
  usePriceGuideImport,
} from '../hooks/usePriceGuideImport';

import type { PriceGuideImportConfig } from '../types';

// Mock the hooks module
vi.mock('../hooks/usePriceGuideImport', () => ({
  useSourceConnection: vi.fn(),
  usePriceGuideSourceCounts: vi.fn(),
  useOfficeMappings: vi.fn(),
  usePriceGuideImport: vi.fn(),
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
const defaultConnectionMock = {
  data: { connected: true },
  isLoading: false,
  error: null,
};

const defaultSourceCountsMock = {
  data: {
    categories: 24,
    msis: 1247,
    options: 3892,
    upCharges: 856,
    additionalDetails: 412,
    images: 156,
  },
  isLoading: false,
  error: null,
};

const defaultOfficeMappingsMock = {
  data: [
    {
      sourceId: 'source-office-1',
      sourceName: 'Main Office',
      targetId: 'target-office-1',
      targetName: 'Main Office (New)',
      msiCount: 847,
    },
    {
      sourceId: 'source-office-2',
      sourceName: 'West Branch',
      targetId: 'target-office-2',
      targetName: 'West Branch (New)',
      msiCount: 234,
    },
  ],
  isLoading: false,
  error: null,
};

const defaultImportMock = {
  isImporting: false,
  session: null,
  config: {
    priceTypeStrategy: 'combined',
    autoCreateCategories: true,
    duplicateHandling: 'skip',
    includeImages: true,
  } as PriceGuideImportConfig,
  progress: {
    phase: 'idle' as const,
    overallProgress: 0,
    categories: { done: 0, total: 0 },
    additionalDetails: { done: 0, total: 0 },
    options: { done: 0, total: 0 },
    upCharges: { done: 0, total: 0 },
    msis: { done: 0, total: 0 },
    images: { done: 0, total: 0 },
    elapsedTime: 0,
    estimatedRemaining: 0,
  },
  results: null,
  importError: null,
  hasFailed: false,
  isComplete: false,
  updateConfig: vi.fn(),
  startImport: vi.fn(),
  reset: vi.fn(),
};

describe('PriceGuideMigrationWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSourceConnection).mockReturnValue(
      defaultConnectionMock as ReturnType<typeof useSourceConnection>,
    );
    vi.mocked(usePriceGuideSourceCounts).mockReturnValue(
      defaultSourceCountsMock as ReturnType<typeof usePriceGuideSourceCounts>,
    );
    vi.mocked(useOfficeMappings).mockReturnValue(
      defaultOfficeMappingsMock as ReturnType<typeof useOfficeMappings>,
    );
    vi.mocked(usePriceGuideImport).mockReturnValue(defaultImportMock);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Prerequisites Step (Step 1)', () => {
    it('should render the wizard with title and stepper', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByText('Import Price Guide')).toBeInTheDocument();
      expect(screen.getByText('Prerequisites')).toBeInTheDocument();
    });

    it('should show connected status when source is connected', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(
        screen.getByText(/Legacy database connection:.*Connected/i),
      ).toBeInTheDocument();
    });

    it('should show source counts when connected', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByText(/1,247 Measure Sheet Items/)).toBeInTheDocument();
      expect(screen.getByText(/3,892 Options/)).toBeInTheDocument();
      expect(screen.getByText(/856 UpCharges/)).toBeInTheDocument();
    });

    it('should show loading state', () => {
      vi.mocked(useSourceConnection).mockReturnValue({
        ...defaultConnectionMock,
        isLoading: true,
        data: undefined,
      } as ReturnType<typeof useSourceConnection>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show error when source is not connected', () => {
      vi.mocked(useSourceConnection).mockReturnValue({
        data: { connected: false, message: 'MongoDB connection refused' },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useSourceConnection>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(
        screen.getByText(/Cannot connect to legacy database/),
      ).toBeInTheDocument();
    });

    it('should show warning when offices are not mapped', () => {
      vi.mocked(useOfficeMappings).mockReturnValue({
        data: [
          {
            sourceId: 'source-1',
            sourceName: 'Office 1',
            targetId: null,
            targetName: null,
            msiCount: 100,
          },
        ],
        isLoading: false,
        error: null,
      } as ReturnType<typeof useOfficeMappings>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByText(/Please import all offices/)).toBeInTheDocument();
    });

    it('should disable Next button when prerequisites not met', () => {
      vi.mocked(useSourceConnection).mockReturnValue({
        data: { connected: false },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useSourceConnection>);

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });

    it('should enable Next button when prerequisites are met', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
    });

    it('should call onCancel when Cancel button is clicked', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Office Mapping Step (Step 2)', () => {
    it('should navigate to office mapping step', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Click Next to go to step 2
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(
        screen.getByText(/The following offices will receive imported pricing/),
      ).toBeInTheDocument();
    });

    it('should display office mappings table', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText('Main Office')).toBeInTheDocument();
      expect(screen.getByText('West Branch')).toBeInTheDocument();
    });

    it('should show MSI count summary', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText(/1,081 MSIs total/)).toBeInTheDocument();
    });

    it('should navigate back with Back button', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(
        screen.getByText(/Legacy database connection/),
      ).toBeInTheDocument();
    });
  });

  describe('Price Type Step (Step 3)', () => {
    it('should navigate to price type step', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Navigate through steps
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(
        screen.getByText(/Select how to import these prices/),
      ).toBeInTheDocument();
    });

    it('should display price type options', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText('Materials Only')).toBeInTheDocument();
      expect(screen.getByText('Labor Only')).toBeInTheDocument();
      expect(screen.getByText('Materials + Labor')).toBeInTheDocument();
    });

    it('should call updateConfig when price type is changed', () => {
      const mockUpdateConfig = vi.fn();
      vi.mocked(usePriceGuideImport).mockReturnValue({
        ...defaultImportMock,
        updateConfig: mockUpdateConfig,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      // Click materials option
      fireEvent.click(screen.getByLabelText(/Materials Only/));

      expect(mockUpdateConfig).toHaveBeenCalledWith({
        priceTypeStrategy: 'materials',
      });
    });
  });

  describe('Configuration Step (Step 4)', () => {
    it('should navigate to configuration step', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Navigate through steps
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText(/Category Handling/)).toBeInTheDocument();
      expect(screen.getByText(/Duplicate Handling/)).toBeInTheDocument();
      expect(screen.getByText(/Image Migration/)).toBeInTheDocument();
    });

    it('should have image migration checkbox checked by default', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      const checkbox = screen.getByLabelText(/Migrate product images/);
      expect(checkbox).toBeChecked();
    });
  });

  describe('Preview Step (Step 5)', () => {
    it('should navigate to preview step', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Navigate through steps
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }

      expect(screen.getByText('Ready to import:')).toBeInTheDocument();
    });

    it('should display import summary', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }

      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Options')).toBeInTheDocument();
      expect(screen.getByText('UpCharges')).toBeInTheDocument();
      expect(screen.getByText('Measure Sheet Items')).toBeInTheDocument();
    });

    it('should show time estimate', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }

      expect(screen.getByText(/Estimated time:/)).toBeInTheDocument();
    });

    it('should have Start Import button', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }

      expect(
        screen.getByRole('button', { name: /Start Import/ }),
      ).toBeInTheDocument();
    });
  });

  describe('Import Progress Step (Step 6)', () => {
    it('should show progress when importing', () => {
      vi.mocked(usePriceGuideImport).mockReturnValue({
        ...defaultImportMock,
        isImporting: true,
        progress: {
          ...defaultImportMock.progress,
          phase: 'options' as const,
          overallProgress: 42,
          categories: { done: 24, total: 24 },
          options: { done: 1500, total: 3892 },
          upCharges: { done: 0, total: 856 },
          msis: { done: 0, total: 1247 },
          images: { done: 0, total: 156 },
          elapsedTime: 300,
          estimatedRemaining: 600,
        },
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Navigate to preview and start import
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }
      fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));

      expect(screen.getByText(/Importing Price Guide/)).toBeInTheDocument();
      expect(screen.getByText(/42% complete/)).toBeInTheDocument();
    });
  });

  describe('Results Step (Step 7)', () => {
    it('should show results when import completes', () => {
      vi.mocked(usePriceGuideImport).mockReturnValue({
        ...defaultImportMock,
        isComplete: true,
        results: {
          success: true,
          duration: 1800,
          summary: {
            categories: { imported: 24, skipped: 0, errors: 0 },
            options: { imported: 3890, skipped: 2, errors: 0 },
            upCharges: { imported: 856, skipped: 0, errors: 0 },
            msis: { imported: 1247, skipped: 0, errors: 0 },
            images: { imported: 153, skipped: 0, errors: 3 },
          },
          actionItems: [],
          formulaWarnings: [],
        },
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Navigate to results
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }
      fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));

      // Wait a moment for the wizard to advance to results
      // The wizard automatically moves to step 7 when isComplete is true
      expect(screen.getByText(/Import Complete/)).toBeInTheDocument();
    });

    it('should call onComplete when Done is clicked', () => {
      vi.mocked(usePriceGuideImport).mockReturnValue({
        ...defaultImportMock,
        isComplete: true,
        results: {
          success: true,
          duration: 1800,
          summary: {
            categories: { imported: 24, skipped: 0, errors: 0 },
            options: { imported: 3890, skipped: 2, errors: 0 },
            upCharges: { imported: 856, skipped: 0, errors: 0 },
            msis: { imported: 1247, skipped: 0, errors: 0 },
            images: { imported: 153, skipped: 0, errors: 3 },
          },
          actionItems: [],
          formulaWarnings: [],
        },
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      // Navigate to results
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }
      fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error alert when import fails', () => {
      vi.mocked(usePriceGuideImport).mockReturnValue({
        ...defaultImportMock,
        hasFailed: true,
        importError: 'Failed to connect to legacy database',
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }
      fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));

      expect(screen.getByText('Import Failed')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to connect to legacy database'),
      ).toBeInTheDocument();
    });

    it('should call reset when Try Again is clicked', () => {
      const mockReset = vi.fn();
      vi.mocked(usePriceGuideImport).mockReturnValue({
        ...defaultImportMock,
        hasFailed: true,
        importError: 'Failed',
        reset: mockReset,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PriceGuideMigrationWizard
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Wrapper>,
      );

      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      }
      fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));

      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
      expect(mockReset).toHaveBeenCalled();
    });
  });
});
