import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar.jsx';
import AppSidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import { CopilotWidget } from '@/components/CopilotWidget.jsx';
import { CommandPalette } from '@/components/CommandPalette.jsx';
import { InspectorProvider } from '@/components/inspector/InspectorProvider.jsx';
import { SchemaInspector } from '@/components/inspector/SchemaInspector.jsx';
import { findActiveGroup } from './Sidebar.jsx';
import { getSectionColor } from '@/lib/sectionColors.js';

export default function AppLayout({ menuGroups }) {
  const location = useLocation();
  const activeGroup = findActiveGroup(menuGroups, location.pathname);
  const sectionColor = getSectionColor(activeGroup?.group);

  return (
    <InspectorProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar menuGroups={menuGroups} />
        <SidebarInset>
          <TopBar menuGroups={menuGroups} />
          <div
            key={location.pathname}
            className="relative flex-1 overflow-auto p-6 page-transition content-bg"
            style={{ '--section-accent': sectionColor.accent }}
          >
            <div className="relative z-10">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <CopilotWidget />
      <CommandPalette />
      <SchemaInspector />
    </InspectorProvider>
  );
}
