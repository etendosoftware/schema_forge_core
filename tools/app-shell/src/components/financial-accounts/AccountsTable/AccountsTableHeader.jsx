import { TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { useUI } from '@/i18n';

export function AccountsTableHeader() {
  const ui = useUI();
  return (
    <TableHeader>
      <TableRow className="h-10 border-b border-[#E8EAEF] bg-white hover:bg-white">
        <TableHead className="w-[336px] pl-[84px] pr-2 text-xs font-semibold leading-4 text-[#121217]">
          {ui('financeAccountsColAccount')}
        </TableHead>
        <TableHead className="w-[340px] px-2 text-xs font-semibold leading-4 text-[#121217]">
          {ui('financeAccountsColType')}
        </TableHead>
        <TableHead className="w-[200px] px-2 text-xs font-semibold leading-4 text-[#121217]">
          {ui('financeAccountsColBalance')}
        </TableHead>
        <TableHead className="w-[280px] px-2 text-xs font-semibold leading-4 text-[#121217]">
          {ui('financeAccountsColPending')}
        </TableHead>
        <TableHead className="min-w-[90px]" />
      </TableRow>
    </TableHeader>
  );
}
