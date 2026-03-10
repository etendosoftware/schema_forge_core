import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'quantity', column: 'Qty', type: 'number' },
  { key: 'unitPrice', column: 'PriceActual', type: 'amount' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'needByDate', column: 'NeedByDate', type: 'date' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];

const filters = ['product'];

export default function RequisitionLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
