import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', label: 'Line No', type: 'number', required: true, readOnly: true },
  { key: 'product', label: 'Product', type: 'search', required: true, readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true, readOnly: true },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', required: true, readOnly: true },
  { key: 'lineNetAmount', label: 'Line Net Amount', type: 'number', readOnly: true },
  { key: 'needByDate', label: 'Need By Date', type: 'date', readOnly: true },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', readOnly: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
  { key: 'matchedPOQty', label: 'Matched P O Qty', type: 'number', readOnly: true },
  { key: 'requisitionOrder', label: 'Requisition Order', type: 'search', readOnly: true, reference: 'RequisitionOrder' },
];

export default function RequisitionLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
