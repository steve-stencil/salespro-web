/**
 * Main application component.
 * Wraps the router with necessary providers including MUI theme.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { router } from './router';
import { ColorModeProvider } from './theme';

/**
 * TanStack Query client configuration.
 * Configured for auth-related queries with sensible defaults.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Root application component with providers.
 * Provider order: ErrorBoundary -> ColorMode -> QueryClient -> Auth -> Router
 */
function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <ColorModeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </ColorModeProvider>
    </ErrorBoundary>
  );
}

export default App;
