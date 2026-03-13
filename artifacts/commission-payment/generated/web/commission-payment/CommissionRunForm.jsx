import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:commissionRun
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'commission', column: 'C_Commission_ID', type: 'selector', required: true, section: 'principal', reference: 'Commission', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true, section: 'principal' },
  { key: 'endDate', column: 'EndDate', type: 'date', section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:commissionRun

// @sf-generated-start component:CommissionRunForm
export default function CommissionRunForm(props) {
  // @sf-custom-slot hooks:CommissionRunForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CommissionRunForm

// @sf-custom-slot section:CommissionRunForm-custom
