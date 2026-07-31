import { useMemo } from 'react';

/** Fixture: a `custom` cell over a plain string column — text mode is correct. */
export default function NotesTable() {
  const columns = useMemo(() => [
    { key: 'notes', column: 'Description', type: 'custom', render: (row) => <em>{row.notes}</em> },
  ], []);
  return <div>{columns.length}</div>;
}
