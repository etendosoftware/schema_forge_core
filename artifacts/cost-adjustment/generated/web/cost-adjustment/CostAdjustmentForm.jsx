import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:costAdjustment
const fields = [
  { key: 'organization', column: 'AD_Org_ID', type: 'selector', required: true, section: 'principal', reference: 'Organization', inputMode: 'selector' },
  { key: 'documentDate', column: 'DateAcct', type: 'date', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'referenceNo', column: 'ReferenceNo', type: 'text', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:costAdjustment

// @sf-generated-start component:CostAdjustmentForm
export default function CostAdjustmentForm(props) {
  // @sf-custom-slot hooks:CostAdjustmentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CostAdjustmentForm

// @sf-custom-slot section:CostAdjustmentForm-custom
