import { useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import AppSidebar from './Sidebar.jsx';
import { CommandPalette } from '@/components/CommandPalette.jsx';
import { findActiveGroup } from './Sidebar.jsx';
import { getSectionColor } from '@/lib/sectionColors.js';
import { CopilotProvider } from '@/components/CopilotContext';
import { CopilotWidget } from '@/components/CopilotWidget';
import { CurrentWindowProvider } from '@/components/CurrentWindowContext';

export default function AppLayout({ menuGroups }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeGroup = findActiveGroup(menuGroups, location.pathname);
  const sectionColor = getSectionColor(activeGroup?.group);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try { return localStorage.getItem('sidebar-expanded') === 'true'; } catch { return false; }
  });

  const marginLeft = sidebarExpanded ? 240 : 60;

  const embedded = searchParams.get('embedded') === '1';

  return (
    <CurrentWindowProvider>
    <CopilotProvider>
      {!embedded && (
        <AppSidebar
          menuGroups={menuGroups}
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(prev => {
            const next = !prev;
            try { localStorage.setItem('sidebar-expanded', String(next)); } catch {}
            return next;
          })}
        />
      )}
      <div
        className="flex h-screen flex-col overflow-hidden transition-[margin-left] duration-200 ease-in-out bg-background"
        style={{ marginLeft: embedded ? 0 : marginLeft }}
      >
        <div
          key={location.pathname}
          className="relative flex-1 flex flex-col overflow-hidden page-transition"
        >
          <div className="flex-1 flex flex-col min-h-0">
            <Outlet />
          </div>
        </div>
      </div>
      {!embedded && <CommandPalette />}
      {!embedded && <CopilotWidget />}
    </CopilotProvider>
    </CurrentWindowProvider>
  );
}
