import { useMemo } from 'react';

/**
 * Fixture: neither custom column has a contract counterpart — `_siiStatus` is a
 * pure render cell, `aeatsiiEstado` even names a real AD column that the
 * contract does not expose.
 */
export default function SyntheticTable() {
  const columns = useMemo(() => [
    { key: 'documentNo', column: 'DocumentNo', type: 'string' },
    { key: '_siiStatus', type: 'custom', render: (row) => <span>{row.aeatsiiEstado}</span> },
    {
      key: 'aeatsiiEstado',
      column: 'EM_Aeatsii_Estado',
      type: 'custom',
      render: (row) => <span>{row.aeatsiiEstado}</span>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
