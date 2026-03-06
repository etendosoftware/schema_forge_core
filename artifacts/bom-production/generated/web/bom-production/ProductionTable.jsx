import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'movementDate', label: 'Movement Date', type: 'date' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'productionQuantity', label: 'Production Quantity', type: 'number' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
];

const filters = ['documentNo', 'name', 'movementDate', 'product', 'docStatus'];

export default function ProductionTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
