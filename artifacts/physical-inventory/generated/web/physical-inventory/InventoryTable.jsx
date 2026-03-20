import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date' },
  { key: 'inventoryType', column: 'InventoryType', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['warehouse', 'movementDate', 'inventoryType', 'documentNo', 'docStatus'];

export default function InventoryTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
