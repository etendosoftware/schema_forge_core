import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:usedCreditSource
const fields = [
  { key: 'creditPaymentUsed', column: 'FIN_Payment_Id_Used', type: 'search', required: true, section: 'principal', reference: 'Payment', inputMode: 'search' },
  { key: 'amount', column: 'Amount', type: 'text', required: true, section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, section: 'principal', reference: 'Currency', inputMode: 'selector' },
];
// @sf-generated-end fields:usedCreditSource

// @sf-generated-start component:UsedCreditSourceForm
export default function UsedCreditSourceForm(props) {
  // @sf-custom-slot hooks:UsedCreditSourceForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:UsedCreditSourceForm

// @sf-custom-slot section:UsedCreditSourceForm-custom
