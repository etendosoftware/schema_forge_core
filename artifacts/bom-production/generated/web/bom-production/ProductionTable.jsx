import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'productionQuantity', column: 'ProductionQty', type: 'number' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['documentNo', 'name', 'movementDate', 'product', 'docStatus'];

export default function ProductionTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
