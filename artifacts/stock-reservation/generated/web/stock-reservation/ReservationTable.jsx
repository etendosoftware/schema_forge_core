import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'warehouse', label: 'Warehouse', type: 'string' },
  { key: 'reservedQty', label: 'Reserved Qty', type: 'number' },
  { key: 'releasedQty', label: 'Released Qty', type: 'number' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'salesOrderLine', label: 'Sales Order Line', type: 'string' },
  { key: 'uom', label: 'Uom', type: 'string' },
];

const filters = ['documentNo', 'product', 'warehouse', 'status'];

export default function ReservationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
