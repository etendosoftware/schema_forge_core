// Mirrors AmortizationLinesTable.jsx CORE_FIELDS: 'asset' required=true here
// is intentional (guards an inline-add-row save) and is suppressed via the
// F18 allowlist. 'other' has the same kind of drift but is NOT allowlisted,
// so it must still be reported — proves suppression is selective.
import { DataTable } from '@/components/contract-ui';

const CORE_FIELDS = [
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', required: true },
  { key: 'other', column: 'Other_Column', type: 'string', required: true },
];

export default function CustomTable(props) {
  return <DataTable columns={CORE_FIELDS} {...props} />;
}
