/**
 * Wrapper component that provides app context within the router.
 *
 * This component wraps the app layouts and provides the AppProvider
 * which requires access to useLocation from react-router-dom.
 */
import { Outlet } from 'react-router-dom';

import { AppProvider } from '../shared/context/AppContext';

/**
 * Wrapper that provides app context to all child routes.
 */
export function AppProviderWrapper(): React.ReactElement {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  );
}
