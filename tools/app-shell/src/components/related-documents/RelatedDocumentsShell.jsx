import { Loader2 } from 'lucide-react';
import { useUI } from '@/i18n';

export default function RelatedDocumentsShell({ loading, children }) {
  const ui = useUI();

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {ui('loading')}
      </span>
    );
  }

  const hasChildren = Array.isArray(children)
    ? children.filter(Boolean).length > 0
    : !!children;

  if (!hasChildren) {
    return <span className="text-xs text-muted-foreground/50">{ui('noRelatedDocuments')}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {children}
    </div>
  );
}
