import { useMemo } from 'react';

/** Fixture: pipeline-window convention — custom component inside the artifact dir. */
export default function ArtifactCustomTable() {
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
