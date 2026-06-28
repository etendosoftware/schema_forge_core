import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:General
const fields = [
  { key: 'organization', column: 'AD_Org_ID', type: 'selector', label: 'Organization', required: true, readOnly: true, section: 'identity', reference: 'Org', inputMode: 'selector', defaultValue: '@AD_Org_ID@' },
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'identity' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'identity' },
  { key: 'gAAP', column: 'GAAP', type: 'select', label: 'Accounting Standard', required: true, section: 'identity', options: [{ value: 'FR', label: 'French Accounting Standard' }, { value: 'DE', label: 'German HGB' }, { value: 'IF', label: 'IFRS' }, { value: 'SA', label: 'Spanish Accounting Standard' }, { value: 'US', label: 'US GAAP' }, { value: 'XX', label: 'Custom' }, { value: 'OT', label: 'Other' }], defaultValue: 'OT' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency', required: true, section: 'calendar', reference: 'Currency', inputMode: 'selector' },
  { key: 'accrual', column: 'IsAccrual', type: 'checkbox', label: 'Accrual', section: 'identity', defaultValue: 'Y' },
  { key: 'automaticPeriodControl', column: 'AutoPeriodControl', type: 'checkbox', label: 'Automatic Period Control', section: 'policies' },
];
// @sf-generated-end fields:General

// @sf-generated-start component:GeneralForm
export default function GeneralForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:GeneralForm
