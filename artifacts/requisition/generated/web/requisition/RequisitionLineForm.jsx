import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'needByDate', column: 'NeedByDate', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function RequisitionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
