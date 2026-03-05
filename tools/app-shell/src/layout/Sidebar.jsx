import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard } from 'lucide-react';

export default function Sidebar({ menuItems }) {
  return (
    <aside className="w-60 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold tracking-tight">Schema Forge</h1>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map(item => (
          <NavLink
            key={item.name}
            to={`/${item.name}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent text-accent-foreground'
              )
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
