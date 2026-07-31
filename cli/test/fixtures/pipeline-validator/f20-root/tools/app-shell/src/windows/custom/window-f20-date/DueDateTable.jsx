import { useMemo } from 'react';

/** Fixture: a `custom` cell over a `date` contract field with no filterMode. */
export default function DueDateTable() {
  const columns = useMemo(() => [
    { key: 'documentNo', column: 'DocumentNo', type: 'string' },
    {
      key: 'eTGODueDate',
      column: 'EM_Etgo_Due_Date',
      type: 'custom',
      render: (row) => <span>{row.eTGODueDate}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
