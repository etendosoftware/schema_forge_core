import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:returnMaterialLine
const columns = [
  { key: 'originalReceiptLine', column: 'M_InOutLine_ID', type: 'string' },
  { key: 'quantity', column: 'Qty', type: 'number' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
  { key: 'lineAmount', column: 'Amt', type: 'amount' },
];
// @sf-generated-end columns:returnMaterialLine

const filters = ['product'];

// @sf-generated-start component:ReturnMaterialLineTable
export default function ReturnMaterialLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReturnMaterialLineTable
