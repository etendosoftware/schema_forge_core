import { SidebarTrigger } from '@/components/ui/sidebar.jsx';
import { Separator } from '@/components/ui/separator.jsx';

export default function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1" />
    </header>
  );
}
