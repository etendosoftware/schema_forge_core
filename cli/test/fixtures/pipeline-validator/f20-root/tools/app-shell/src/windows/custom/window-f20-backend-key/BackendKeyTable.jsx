import { useMemo } from 'react';

/**
 * Fixture: no `column`, but an explicit `backendFilterKey` — the column IS
 * offered as a filter, so the missing numeric filterMode is a real degradation.
 */
export default function BackendKeyTable() {
  const columns = useMemo(() => [
    {
      key: 'outstandingAmount',
      backendFilterKey: 'outstandingAmt',
      type: 'custom',
      render: (row) => <span>{row.outstandingAmount}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
