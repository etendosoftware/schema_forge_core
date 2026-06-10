import { useMemo, useState } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AdvancedFilterBuilder } from '@/components/contract-ui/AdvancedFilterBuilder.jsx';
import { useUI } from '@/i18n';
import { AccountTypeFilter } from './AccountTypeFilter.jsx';
import { buildAccountFilterColumns } from './accountAdvancedFilter.js';

/**
 * Toolbar above the accounts table. Sizes match Figma `3012:25602`:
 *   - Wrapper: 56 px tall, padding 8 px, space-between.
 *   - Left group: type filter (181 px × 40 px).
 *   - Right group: search (232 px), matching rules (188 px), new account (153 px),
 *     each 40 px tall.
 */
export function AccountsToolbar({
  typeFilter,
  onTypeFilterChange,
  search,
  onSearchChange,
  onNewAccount,
  advancedFilter = null,
  onAdvancedFilterChange,
  rows = [],
}) {
  const ui = useUI();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const columns = useMemo(() => buildAccountFilterColumns(ui), [ui]);
  const activeConditions = advancedFilter?.conditions?.length ?? 0;

  const handleRulesClick = () => {
    toast(ui('financeAccountsRulesToast'));
  };

  return (
    <div
      className="flex h-10 items-center justify-between gap-2.5"
      data-testid="cuentas-toolbar"
    >
      <div className="flex items-center gap-2">
        <AccountTypeFilter value={typeFilter} onChange={onTypeFilterChange} />

        {/* Advanced "by conditions" filter — same as the other windows. */}
        {onAdvancedFilterChange ? (
          <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="cuentas-advanced-filter"
                title={ui('advancedFilterTitle')}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:bg-[#F5F7F9] hover:text-foreground"
              >
                <Filter className="h-4 w-4" />
                {activeConditions > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#121217] px-1 text-[10px] font-semibold leading-none text-white">
                    {activeConditions}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-4">
              <AdvancedFilterBuilder
                columns={columns}
                rows={rows}
                value={advancedFilter}
                onApply={(next) => onAdvancedFilterChange(next)}
                onClear={() => onAdvancedFilterChange(null)}
                onClose={() => setAdvancedOpen(false)}
              />
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative h-10 w-[232px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#828FA3]" />
          <Input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={ui('financeAccountsSearchPlaceholder')}
            className="h-10 rounded-lg border-[#D1D4DB] bg-white pl-10 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] placeholder:text-[#6C6C89]"
            data-testid="cuentas-search-input"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleRulesClick}
          className="h-10 w-[188px] gap-1 rounded-lg border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9] [&_svg]:size-5"
          data-testid="cuentas-matching-rules-button"
        >
          <Filter className="text-[#828FA3]" />
          {ui('financeAccountsMatchingRules')}
        </Button>

        <Button
          type="button"
          onClick={onNewAccount}
          className="group h-10 w-[153px] gap-1 rounded-lg bg-[#121217] px-3 text-sm font-medium leading-6 text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217] [&_svg]:size-5"
          data-testid="cuentas-new-account-button"
        >
          <Plus className="text-white/90 group-hover:text-[#121217]" />
          {ui('financeAccountsNewAccount')}
        </Button>
      </div>
    </div>
  );
}
