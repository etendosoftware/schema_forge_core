import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:customerReturnLine
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.' },
  { key: 'product', column: 'M_Product_ID', type: 'selector', label: 'Product' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', label: 'Returned Quantity' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', label: 'Net Unit Price' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount', label: 'Line Net Amount' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'amount', label: 'Line Gross Amount' },
  { key: 'goodsShipmentLine', column: 'M_Inoutline_ID', type: 'selector', label: 'Goods Shipment Line' },
];
// @sf-generated-end columns:customerReturnLine

const filters = ['goodsShipmentLine'];

// @sf-generated-start component:CustomerReturnLineTable
export default function CustomerReturnLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:CustomerReturnLineTable
