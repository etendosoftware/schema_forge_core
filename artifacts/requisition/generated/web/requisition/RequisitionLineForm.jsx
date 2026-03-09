import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'needByDate', label: 'Need By Date', type: 'date' },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'lineNetAmount', label: 'Line Net Amount', type: 'number', readOnly: true },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function RequisitionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
