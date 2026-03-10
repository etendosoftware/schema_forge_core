import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'inspectionDate', column: 'InspectionDate', type: 'date', required: true },
  { key: 'result', column: 'Result', type: 'text', required: true },
  { key: 'inspector', column: 'Inspector', type: 'text', required: true },
  { key: 'notes', column: 'Notes', type: 'textarea' },
  { key: 'quantityInspected', column: 'QtyInspected', type: 'number', required: true },
  { key: 'quantityAccepted', column: 'QtyAccepted', type: 'number', required: true },
  { key: 'quantityRejected', column: 'QtyRejected', type: 'number', readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
];

export default function QualityCheckForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
