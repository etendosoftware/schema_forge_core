import { SidebarTrigger } from '@/components/ui/sidebar.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { useInspector } from '@/components/inspector/InspectorProvider.jsx';
import { Pencil, PencilOff, Save, Loader2 } from 'lucide-react';
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
