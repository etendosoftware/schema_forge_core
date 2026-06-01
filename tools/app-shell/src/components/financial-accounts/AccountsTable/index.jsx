import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useUI } from '@/i18n';
import { AccountsTableHeader } from './AccountsTableHeader.jsx';
import { AccountRow } from './AccountRow.jsx';

const SKELETON_ROW_KEYS = [
  'skeleton-row-1',
  'skeleton-row-2',
  'skeleton-row-3',
  'skeleton-row-4',
  'skeleton-row-5',
];

function LoadingRows() {
  return (
    <>
      {SKELETON_ROW_KEYS.map((key) => (
        <TableRow key={key} className="h-16">
          <TableCell className="w-[336px] p-0">
            <div className="flex items-center">
              <div className="w-[44px]" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1 px-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell className="w-[340px]">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-40" />
            </div>
          </TableCell>
          <TableCell className="w-[200px] text-right">
            <Skeleton className="ml-auto h-4 w-24" />
          </TableCell>
          <TableCell className="w-[280px]">
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="min-w-[90px]" />
        </TableRow>
      ))}
    </>
  );
}

function EmptyState({ message }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="py-12 text-center text-sm text-[#6c6c89]">
        {message}
      </TableCell>
    </TableRow>
  );
}

function ErrorState({ message, onRetry, retryLabel }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="py-12 text-center">
        <p className="text-sm text-[#d50b3e]">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-medium text-[#121217] underline underline-offset-4"
          >
            {retryLabel}
          </button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function AccountsTable({
  accounts,
  loading,
  error,
  onOpen,
  onReconcile,
  onEdit,
  onArchive,
  onRetry,
}) {
  const ui = useUI();
  const rowCount = accounts?.length ?? 0;

  const renderBody = () => {
    if (loading) {
      return <LoadingRows />;
    }
    if (error) {
      return (
        <ErrorState
          message={ui('financeAccountsLoadError')}
          onRetry={onRetry}
          retryLabel={ui('financeAccountsRetry')}
        />
      );
    }
    if (rowCount === 0) {
      return <EmptyState message={ui('financeAccountsEmpty')} />;
    }
    return accounts.map((account) => (
      <AccountRow
        key={account.id}
        account={account}
        onOpen={onOpen}
        onReconcile={onReconcile}
        onEdit={onEdit}
        onArchive={onArchive}
      />
    ));
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white [&>div]:overflow-visible">
      <Table>
        <AccountsTableHeader />
        <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-[#E8EAEF]">
          {renderBody()}
        </TableBody>
      </Table>
    </div>
  );
}
