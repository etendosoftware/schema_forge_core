import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'movementDate', label: 'Movement Date', type: 'date' },
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
];

const filters = ['movementDate', 'documentNo', 'docStatus'];

export default function GoodsMovementTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
