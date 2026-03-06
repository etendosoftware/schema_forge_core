import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Eye } from 'lucide-react';

export default function Sidebar({ menuItems }) {
  return (
    <aside className="w-60 flex flex-col" style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}>
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight text-white">Schema Forge</h1>
        <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--sidebar-text))' }}>ERP Generator</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map(item => (
          <NavLink
            key={item.name}
            to={`/${item.name}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <NavLink
          to="/preview"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:bg-white/10 hover:text-white/80'
            )
          }
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </NavLink>
      </div>
    </aside>
  );
}
