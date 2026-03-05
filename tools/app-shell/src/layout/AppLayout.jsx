import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';

export default function AppLayout({ menuItems }) {
  return (
    <div className="h-screen flex">
      <Sidebar menuItems={menuItems} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
