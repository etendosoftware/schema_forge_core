import { useMemo } from 'react';

/** Fixture: the `custom` cell declares the filterMode the amount column needs. */
export default function DeclaredTable() {
  const columns = useMemo(() => [
    { key: 'documentNo', column: 'DocumentNo', type: 'string' },
    {
      key: 'outstandingAmount',
      column: 'OutstandingAmt',
      type: 'custom',
      filterMode: 'numeric',
      render: (row) => <span>{row.outstandingAmount}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
