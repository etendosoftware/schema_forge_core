import { useMemo } from 'react';

const amountDefaults = { filterMode: 'numeric' };

/** Fixture: the spread could supply filterMode — statically indeterminate. */
export default function SpreadTable() {
  const columns = useMemo(() => [
    { key: 'documentNo', column: 'DocumentNo', type: 'string' },
    {
      key: 'grandTotalAmount',
      column: 'GrandTotal',
      type: 'custom',
      ...amountDefaults,
      render: (row) => <span>{row.grandTotalAmount}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
