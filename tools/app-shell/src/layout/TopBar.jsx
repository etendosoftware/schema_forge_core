import { SidebarTrigger } from '@/components/ui/sidebar.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { useInspector } from '@/components/inspector/InspectorProvider.jsx';
import { Pencil, PencilOff, Save, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function TopBar() {
  const inspector = useInspector();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      {inspector.editMode && (
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
          Edit Mode
        </Badge>
      )}
      <div className="flex-1" />
      <Button
        variant="outline"
        className="relative h-8 w-full justify-start rounded-[0.5rem] bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        }}
      >
        <Search className="mr-2 h-4 w-4" />
        Search...
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>
      {inspector.editMode && inspector.dirty && (
        <Button size="sm" onClick={inspector.save} disabled={inspector.saving}>
          {inspector.saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save &amp; Regenerate
        </Button>
      )}
      <Button
        variant={inspector.editMode ? 'default' : 'outline'}
        size="icon"
        onClick={() => inspector.setEditMode(!inspector.editMode)}
      >
        {inspector.editMode ? <PencilOff className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        <span className="sr-only">Toggle edit mode</span>
      </Button>
    </header>
  );
}
