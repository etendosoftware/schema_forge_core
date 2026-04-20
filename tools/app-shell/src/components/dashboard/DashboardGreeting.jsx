import { ChevronDown, Sparkles, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUI } from '@/i18n';
import { useDashboardDateRange } from './DashboardDateRangeContext';

const RANGE_KEYS = [
  { value: 'lastYear', labelKey: 'dashboardRangeLastYear' },
  { value: 'last90d',  labelKey: 'dashboardRangeLast90d' },
  { value: 'last30d',  labelKey: 'dashboardRangeLast30d' },
  { value: 'mtd',      labelKey: 'dashboardRangeMtd' },
  { value: 'ytd',      labelKey: 'dashboardRangeYtd' },
];

export function DashboardGreeting({ username = '', onAskCopilot }) {
  const ui = useUI();
  const { range, setRange } = useDashboardDateRange();

  const currentRangeLabel = ui(RANGE_KEYS.find((r) => r.value === range)?.labelKey ?? 'dashboardRangeLastYear');
  const greeting = ui('dashboardGreetingHello').replace('{name}', username || '');

  return (
    <div className="flex items-start justify-between gap-4 mb-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0" aria-hidden>🙂</span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground leading-tight">{greeting}</p>
          <h1 className="text-xl font-bold leading-tight truncate">{ui('dashboardGreetingHeadline')}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{currentRangeLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {RANGE_KEYS.map((r) => (
              <DropdownMenuItem
                key={r.value}
                onSelect={() => setRange(r.value)}
                className={range === r.value ? 'font-semibold' : ''}
              >
                {ui(r.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
          onClick={onAskCopilot}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{ui('dashboardCopilotCta')}</span>
        </Button>
      </div>
    </div>
  );
}
