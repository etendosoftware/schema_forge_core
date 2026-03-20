import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'originalShipmentLine', column: 'M_InOutLine_ID', type: 'string' },
  { key: 'quantity', column: 'Qty', type: 'number' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
  { key: 'lineAmount', column: 'Amt', type: 'amount' },
];

const filters = ['product'];

export default function CustomerReturnLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
