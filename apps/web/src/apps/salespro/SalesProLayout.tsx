/**
 * SalesPro application layout.
 *
 * Uses the shared AppShell with SalesPro-specific sidebar.
 */
import { AppShell } from '../../shared/layouts/AppShell';

import { SalesProSidebar } from './SalesProSidebar';

/**
 * Layout component for the SalesPro app.
 *
 * Wraps the AppShell with the SalesPro-specific sidebar navigation.
 */
export function SalesProLayout(): React.ReactElement {
  return <AppShell sidebar={<SalesProSidebar />} />;
}
