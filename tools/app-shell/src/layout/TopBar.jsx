import { useLocation } from 'react-router-dom';
import { useInspector } from '@/components/inspector/InspectorProvider.jsx';
import {
  Pencil,
  PencilOff,
  Save,
  Loader2,
  Search,
  Sparkles,
  Plus,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import LocaleSwitcher from '@/components/LocaleSwitcher.jsx';
import { useMenuLabel } from '@/i18n';
import { findActiveGroup } from './Sidebar.jsx';

export default function TopBar({ menuGroups }) {
  const inspector = useInspector();
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
        {inspector.editMode && (
          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 mr-1">
            Edit Mode
          </Badge>
        )}
        {inspector.editMode && inspector.dirty && (
          <Button size="sm" variant="outline" onClick={inspector.save} disabled={inspector.saving} className="mr-1">
            {inspector.saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
        )}
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
        <Button
          variant={inspector.editMode ? 'default' : 'ghost'}
          size="icon"
          className="h-9 w-9"
          onClick={() => inspector.setEditMode(!inspector.editMode)}
        >
          {inspector.editMode ? (
            <PencilOff className="h-4 w-4" />
          ) : (
            <Pencil className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="sr-only">Toggle edit mode</span>
        </Button>
      </div>
    </header>
  );
}
