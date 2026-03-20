import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'movementDate', column: 'MovementDate', type: 'date' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['movementDate', 'documentNo', 'docStatus'];

export default function GoodsMovementTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
