import { useLocation } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Plus,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import LocaleSwitcher from '@/components/LocaleSwitcher.jsx';
import { useMenuLabel } from '@/i18n';
import { findActiveGroup } from './Sidebar.jsx';

export default function TopBar({ menuGroups }) {
  const location = useLocation();
  const activeGroup = findActiveGroup(menuGroups, location.pathname);
  const currentPath = location.pathname.replace(/^\//, '');
  const tMenu = useMenuLabel();

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border/50 bg-white">
      {/* Left: section context */}
      <div className="flex min-w-0 items-center gap-2 px-4">
        {activeGroup && (
          <span className="text-sm font-semibold text-foreground">{tMenu(activeGroup.group)}</span>
        )}
        {!activeGroup && (
          <span className="text-sm text-muted-foreground">
            {currentPath || 'Home'}
          </span>
        )}
      </div>

      {/* Center: global search */}
      <div className="flex flex-1 justify-center px-4">
        <Button
          variant="outline"
          className="relative h-9 w-full max-w-md justify-start rounded-lg border-border/50 bg-muted/30 text-sm font-normal text-muted-foreground shadow-none"
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true })
            );
          }}
        >
          <Search className="mr-2 h-4 w-4" />
          Search...
          <kbd className="pointer-events-none absolute right-2 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </Button>
      </div>

      {/* Right: action icons */}
      <div className="flex shrink-0 items-center gap-1 px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
