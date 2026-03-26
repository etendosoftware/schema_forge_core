import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:customerReturnLine
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'string' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'string' },
  { key: 'unitPrice', column: 'PriceActual', type: 'string' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount' },
  { key: 'goodsShipmentLine', column: 'M_Inoutline_ID', type: 'string' },
];
// @sf-generated-end columns:customerReturnLine

const filters = ['goodsShipmentLine'];

// @sf-generated-start component:CustomerReturnLineTable
export default function CustomerReturnLineTable(props) {
  // @sf-custom-slot hooks:CustomerReturnLineTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:CustomerReturnLineTable

// @sf-custom-slot section:CustomerReturnLineTable-custom
