/**
 * Dashboard application layout.
 *
 * Uses the shared AppShell with Dashboard-specific sidebar.
 */
import { AppShell } from '../../shared/layouts/AppShell';

import { DashboardSidebar } from './DashboardSidebar';

/**
 * Layout component for the Dashboard app.
 *
 * Wraps the AppShell with the Dashboard-specific sidebar navigation.
 */
export function DashboardLayout(): React.ReactElement {
  return <AppShell sidebar={<DashboardSidebar />} />;
}
