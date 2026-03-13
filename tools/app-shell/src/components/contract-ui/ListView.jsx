import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useEntity } from '@/hooks/useEntity';
import { useMenuLabel } from '@/i18n';

/**
 * Full-width list view for an entity.
 *
 * Props:
 *  - entity: string
 *  - Table: React component (DataTable wrapper with columns/filters baked in)
 *  - entityLabel: string
 *  - windowName: string (URL slug, used for navigation)
 *  - token: string
 *  - apiBaseUrl: string
 */
export function ListView({
  entity,
  Table,
  entityLabel,
  windowName,
  token,
  apiBaseUrl,
}) {
  const hook = useEntity(entity, null, { token, apiBaseUrl });
  const navigate = useNavigate();
  const tMenu = useMenuLabel();
  const label = tMenu(entityLabel) || entityLabel || entity;

  return (
    <div className="h-[calc(100vh-7.5rem)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">{label}</h2>
          {!hook.loading && (
            <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full">
              {hook.items.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1"
          onClick={() => navigate(`/${windowName}/new`)}
        >
          + New
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {hook.loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table
            entity={entity}
            data={hook.items}
            onNavigate={(row) => navigate(`/${windowName}/${row.id}`)}
            compact={false}
          />
        )}
      </div>
    </div>
  );
}
