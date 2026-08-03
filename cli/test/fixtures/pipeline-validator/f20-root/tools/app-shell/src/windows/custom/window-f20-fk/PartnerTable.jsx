import { useMemo } from 'react';

/** Fixture: the `_ID` heuristic already resolves this to identifier at runtime. */
export default function PartnerTable() {
  const columns = useMemo(() => [
    {
      key: 'businessPartner',
      column: 'C_BPartner_ID',
      type: 'custom',
      render: (row) => <b>{row['businessPartner$_identifier']}</b>,
    },
  ], []);
  return <div>{columns.length}</div>;
}
