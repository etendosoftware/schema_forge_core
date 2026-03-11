import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.jsx';
import {
  Eye,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Calculator,
  Package,
  Users,
  Settings,
  FolderKanban,
  Target,
  LogOut,
  FileJson,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { getSectionColor } from '@/lib/sectionColors.js';
import { useMenuLabel } from '@/i18n';

const ICON_MAP = {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Calculator,
  Package,
  Users,
  Settings,
  FolderKanban,
  Target,
  Eye,
  FileJson,
};

export function findActiveGroup(menuGroups, pathname) {
  const currentPath = pathname.replace(/^\//, '');
  return menuGroups.find((g) =>
    g.items.some((item) => item.name === currentPath)
  ) || null;
}

const COLLAPSED_W = 60;
const EXPANDED_W = 240;

export default function AppSidebar({ menuGroups, expanded, onToggle }) {
  const { username, logout } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname.replace(/^\//, '');
  const activeGroup = findActiveGroup(menuGroups, location.pathname);
  const tMenu = useMenuLabel();

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    if (activeGroup) initial[activeGroup.group] = true;
    return initial;
  });

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const width = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <TooltipProvider>
      <nav
        className="fixed inset-y-0 left-0 z-50 flex flex-col bg-[hsl(222,47%,11%)] transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width }}
      >
        {/* Header: logo + toggle */}
        <div className={cn(
          'flex shrink-0 items-center py-3 border-b border-white/10',
          expanded ? 'px-4 gap-3' : 'justify-center'
        )}>
          <img
            src="favicon.png"
            alt="Etendo"
            className="h-9 w-9 shrink-0 rounded-lg"
          />
          {expanded && (
            <div className="flex flex-col leading-none min-w-0">
              <span className="text-sm font-semibold text-white truncate">Schema Forge</span>
              <span className="text-[10px] text-white/50">ERP Generator</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white transition-colors',
              expanded ? 'ml-auto' : 'hidden'
            )}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Expand button (only when collapsed) */}
        {!expanded && (
          <div className="flex justify-center py-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand menu</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Menu groups */}
        <div className="flex-1 overflow-auto py-2">
          {menuGroups.map((g) => {
            const Icon = ICON_MAP[g.icon] || Package;
            const isGroupActive = activeGroup?.group === g.group;
            const color = getSectionColor(tMenu(g.group));
            const isOpen = openGroups[g.group];

            if (!expanded) {
              // Collapsed: icon only
              return (
                <div key={g.group} className="flex justify-center py-0.5">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={`/${g.items[0].name}`}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                          isGroupActive
                            ? 'text-white'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        )}
                        style={isGroupActive ? {
                          borderLeft: `3px solid ${color.accent}`,
                          backgroundColor: color.accent + '25',
                        } : undefined}
                      >
                        <Icon className="h-5 w-5" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">{tMenu(g.group)}</TooltipContent>
                  </Tooltip>
                </div>
              );
            }

            // Expanded: group with collapsible items
            return (
              <div key={g.group}>
                <button
                  onClick={() => toggleGroup(g.group)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                    isGroupActive
                      ? 'text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                  style={isGroupActive ? { borderLeft: `3px solid ${color.accent}` } : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{tMenu(g.group)}</span>
                  <ChevronRight className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-90'
                  )} />
                </button>
                {isOpen && (
                  <div className="ml-7 border-l border-white/10 pl-2 py-0.5">
                    {g.items.map((item) => {
                      const isItemActive = item.name === currentPath;
                      return (
                        <NavLink
                          key={item.name}
                          to={`/${item.name}`}
                          className={cn(
                            'block px-3 py-1.5 text-xs rounded-md transition-colors',
                            isItemActive
                              ? 'text-white bg-white/10 font-medium'
                              : 'text-white/50 hover:text-white hover:bg-white/5'
                          )}
                        >
                          {tMenu(item.label)}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={cn(
          'flex flex-col border-t border-white/10 pt-3 pb-3',
          expanded ? 'px-2 gap-1' : 'items-center gap-1.5'
        )}>
          {/* Artifacts */}
          {!expanded ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to="/artifacts"
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                    location.pathname.startsWith('/artifacts')
                      ? 'text-white bg-white/10'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <FileJson className="h-5 w-5" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">Artifacts</TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              to="/artifacts"
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors',
                location.pathname.startsWith('/artifacts')
                  ? 'text-white bg-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <FileJson className="h-4 w-4" />
              <span>Artifacts</span>
            </NavLink>
          )}

          {/* User */}
          {!expanded ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex h-10 w-10 items-center justify-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">
                    <span className="text-xs font-semibold">{username?.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{username}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/60">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                <span className="text-[10px] font-semibold">{username?.charAt(0).toUpperCase()}</span>
              </div>
              <span className="truncate">{username}</span>
            </div>
          )}

          {/* Logout */}
          {!expanded ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={logout}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/60 rounded-md hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
}
