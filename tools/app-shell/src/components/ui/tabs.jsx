import { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

/** @type {React.Context<{ value: string; onValueChange: (v: string) => void } | null>} */
const TabsContext = createContext(null);

/**
 * Simple tab primitives — hand-built because Radix react-tabs is not installed.
 *
 * Usage:
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <TabsTrigger value="one">One</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="one">...</TabsContent>
 *   </Tabs>
 */

export function Tabs({ value, onValueChange, children, className }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('flex flex-col', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }) {
  return (
    <div
      role="tablist"
      className={cn('flex flex-row items-end', className)}
    >
      {children}
    </div>
  );
}

/**
 * @param {{ value: string; children: React.ReactNode; icon?: React.ElementType; badge?: number; className?: string }} props
 */
export function TabsTrigger({ value, children, icon: Icon, badge, className }) {
  const ctx = useContext(TabsContext);
  const isActive = ctx?.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx?.onValueChange(value)}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
        'border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#121217] focus-visible:ring-offset-1',
        isActive
          ? 'border-[#121217] text-[#121217]'
          : 'border-transparent text-[#6c6c89] hover:text-[#3f3f50]',
        className,
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span>{children}</span>
      {badge != null && badge > 0 ? (
        <span className="ml-1 text-xs text-[#6c6c89] font-normal">{badge}</span>
      ) : null}
    </button>
  );
}

/**
 * @param {{ value: string; children: React.ReactNode; className?: string }} props
 */
export function TabsContent({ value, children, className }) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div role="tabpanel" className={cn('flex flex-1 flex-col', className)}>
      {children}
    </div>
  );
}
