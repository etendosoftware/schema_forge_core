import { useMemo } from 'react';

/** Fixture: a `custom` cell over an `amount` contract field with no filterMode. */
export default function AmountTable() {
  const columns = useMemo(() => [
    { key: 'documentNo', column: 'DocumentNo', type: 'string' },
    {
      key: 'outstandingAmount',
      column: 'OutstandingAmt',
      type: 'custom',
      render: (row) => <span>{row.outstandingAmount}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
