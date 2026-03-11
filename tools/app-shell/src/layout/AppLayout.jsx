import { Outlet, useLocation } from 'react-router-dom';
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
      <AppSidebar menuGroups={menuGroups} />
      <div className="ml-[60px] flex h-screen flex-col overflow-hidden">
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
      </div>
      <CopilotWidget />
      <CommandPalette />
      <SchemaInspector />
    </InspectorProvider>
  );
}
