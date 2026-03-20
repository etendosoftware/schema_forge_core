import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:qualityCheck
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'inspectionDate', column: 'InspectionDate', type: 'date', required: true, section: 'principal' },
  { key: 'result', column: 'Result', type: 'text', required: true, section: 'principal' },
  { key: 'inspector', column: 'Inspector', type: 'text', required: true, section: 'other' },
  { key: 'notes', column: 'Notes', type: 'textarea', section: 'other' },
  { key: 'quantityInspected', column: 'QtyInspected', type: 'number', required: true, section: 'other' },
  { key: 'quantityAccepted', column: 'QtyAccepted', type: 'number', required: true, section: 'other' },
  { key: 'quantityRejected', column: 'QtyRejected', type: 'number', readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:qualityCheck

// @sf-generated-start component:QualityCheckForm
export default function QualityCheckForm(props) {
  // @sf-custom-slot hooks:QualityCheckForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:QualityCheckForm

// @sf-custom-slot section:QualityCheckForm-custom
