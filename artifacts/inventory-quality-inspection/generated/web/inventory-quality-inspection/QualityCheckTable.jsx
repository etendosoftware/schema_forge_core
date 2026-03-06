import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'warehouse', label: 'Warehouse', type: 'string' },
  { key: 'inspectionDate', label: 'Inspection Date', type: 'date' },
  { key: 'result', label: 'Result', type: 'string' },
  { key: 'inspector', label: 'Inspector', type: 'string' },
  { key: 'quantityInspected', label: 'Quantity Inspected', type: 'number' },
  { key: 'quantityAccepted', label: 'Quantity Accepted', type: 'number' },
  { key: 'quantityRejected', label: 'Quantity Rejected', type: 'number' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
];

const filters = ['documentNo', 'product', 'warehouse', 'inspectionDate', 'result', 'inspector', 'docStatus'];

export default function QualityCheckTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
