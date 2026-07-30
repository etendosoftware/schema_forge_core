import { useMemo } from 'react';

/**
 * Fixture: the key matches an `amount` contract field, but the column declares
 * neither `column` nor `backendFilterKey` — the ETP-4609 `isFilterableColumn`
 * guard drops it from the Advanced Filter field list, so F20 must stay quiet.
 */
export default function SyntheticAmountTable() {
  const columns = useMemo(() => [
    { key: 'documentNo', column: 'DocumentNo', type: 'string' },
    {
      key: 'outstandingAmount',
      labels: { en_US: 'Outstanding', es_ES: 'Pendiente' },
      type: 'custom',
      sortable: false,
      render: (row) => <span>{row.outstandingAmount}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
