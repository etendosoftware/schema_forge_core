// Mirrors artifacts/sales-invoice/custom/InvoiceHeaderTable.jsx: the file
// that actually renders at runtime (imported by the generated HeaderPage via
// resolveCustomImport()). Has a real required-flag drift.
import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string', required: false },
];

export default function RealTable(props) {
  return <DataTable columns={columns} {...props} />;
}
