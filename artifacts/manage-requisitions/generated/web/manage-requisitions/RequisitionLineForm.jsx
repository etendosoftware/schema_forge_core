import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true, readOnly: true },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true, readOnly: true },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true },
  { key: 'needByDate', column: 'NeedByDate', type: 'date', readOnly: true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', readOnly: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', readOnly: true },
  { key: 'matchedPOQty', column: 'Orderedqty', type: 'number', readOnly: true },
  { key: 'requisitionOrder', column: 'M_Requisitionorder_ID', type: 'search', readOnly: true, reference: 'RequisitionOrder' },
];

export default function RequisitionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
