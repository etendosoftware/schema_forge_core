import { Outlet, NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button.jsx';
import { cn } from '../lib/utils.js';

const COLLAPSED_W = 56;
const EXPANDED_W = 240;

export function ShellMenu({ groups = [], expanded = true, onToggle }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border/50 bg-white transition-[width] duration-200"
      style={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
    >
      <div className="flex h-14 items-center justify-between border-b border-border/40 px-3">
        {expanded && <span className="text-sm font-semibold text-foreground">Schema Forge</span>}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Toggle menu"
          data-testid="Button__69bf59">
          {expanded ? <ChevronLeft className="h-4 w-4" data-testid="ChevronLeft__69bf59" /> : <ChevronRight className="h-4 w-4" data-testid="ChevronRight__69bf59" />}
        </Button>
      </div>
      <nav className="flex-1 overflow-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.id || group.title} className="mb-4">
            {expanded && (
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {(group.items || []).map((item) => (
                <NavLink
                  key={item.path || item.id || item.label}
                  to={item.path || '#'}
                  className={({ isActive }) => cn(
                    'flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    !expanded && 'justify-center'
                  )}
                  title={item.label}
                  data-testid="NavLink__69bf59">
                  {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                  {expanded && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function ShellTopBar({ title, breadcrumb, rightExtras }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-white px-4">
      <div className="min-w-0">
        {breadcrumb && <div className="text-xs text-muted-foreground">{breadcrumb}</div>}
        <h1 className="truncate text-sm font-semibold text-foreground">{title || 'Dashboard'}</h1>
      </div>
      {rightExtras && <div className="flex items-center gap-2">{rightExtras}</div>}
    </header>
  );
}

export function ShellLayout({ menuGroups, title, breadcrumb, rightExtras, children }) {
  const [expanded, setExpanded] = useState(true);
  const marginLeft = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <>
      <ShellMenu
        groups={menuGroups}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        data-testid="ShellMenu__69bf59" />
      <div
        className="flex h-screen flex-col bg-page-bg transition-[margin-left] duration-200"
        style={{ marginLeft }}
      >
        <ShellTopBar
          title={title}
          breadcrumb={breadcrumb}
          rightExtras={rightExtras}
          data-testid="ShellTopBar__69bf59" />
        <main className="min-h-0 flex-1 overflow-auto p-3">
          {children || <Outlet data-testid="Outlet__69bf59" />}
        </main>
      </div>
    </>
  );
}
