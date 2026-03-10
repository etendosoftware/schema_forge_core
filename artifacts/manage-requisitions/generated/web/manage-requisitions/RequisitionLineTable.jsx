import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'quantity', column: 'Qty', type: 'number' },
  { key: 'unitPrice', column: 'PriceActual', type: 'amount' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount' },
  { key: 'needByDate', column: 'NeedByDate', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
  { key: 'matchedPOQty', column: 'Orderedqty', type: 'number' },
  { key: 'requisitionOrder', column: 'M_Requisitionorder_ID', type: 'string' },
];

const filters = ['product'];

export default function RequisitionLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
