import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'reservedQty', column: 'Quantity', type: 'number' },
  { key: 'releasedQty', column: 'ReleasedQty', type: 'number' },
  { key: 'status', column: 'RESStatus', type: 'status' },
  { key: 'salesOrderLine', column: 'C_OrderLine_ID', type: 'string' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];

const filters = ['documentNo', 'product', 'warehouse', 'status'];

export default function ReservationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
