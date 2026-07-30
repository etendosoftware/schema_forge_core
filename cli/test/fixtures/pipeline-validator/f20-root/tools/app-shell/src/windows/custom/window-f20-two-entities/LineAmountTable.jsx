import { useMemo } from 'react';

/** Fixture: `lineAmount` exists on both entities — `column` disambiguates. */
export default function LineAmountTable() {
  const columns = useMemo(() => [
    {
      key: 'lineAmount',
      column: 'LineNetAmt',
      type: 'custom',
      render: (row) => <span>{row.lineAmount}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
