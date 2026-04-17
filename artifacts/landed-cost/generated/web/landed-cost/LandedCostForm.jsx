import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:landedCost
const fields = [
  { key: 'organization', column: 'AD_Org_ID', type: 'selector', required: true, section: 'principal', reference: 'Organization', inputMode: 'selector' },
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'principal' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:landedCost

// @sf-generated-start component:LandedCostForm
export default function LandedCostForm(props) {
  // @sf-custom-slot hooks:LandedCostForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LandedCostForm

// @sf-custom-slot section:LandedCostForm-custom
