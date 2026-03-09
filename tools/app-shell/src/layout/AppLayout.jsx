import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar.jsx';
import AppSidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import { CopilotWidget } from '@/components/CopilotWidget.jsx';

export default function AppLayout({ menuGroups }) {
  return (
    <SidebarProvider>
      <AppSidebar menuGroups={menuGroups} />
      <SidebarInset>
        <TopBar />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <CopilotWidget />
    </SidebarProvider>
  );
}
