import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'warehouse', label: 'Warehouse', type: 'string' },
  { key: 'movementDate', label: 'Movement Date', type: 'date' },
  { key: 'inventoryType', label: 'Inventory Type', type: 'string' },
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
];

const filters = ['warehouse', 'movementDate', 'inventoryType', 'documentNo', 'docStatus'];

export default function InventoryTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
