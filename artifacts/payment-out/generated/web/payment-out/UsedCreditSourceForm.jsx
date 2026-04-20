import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:usedCreditSource
const fields = [
  { key: 'creditPaymentUsed', column: 'FIN_Payment_Id_Used', type: 'search', label: 'Credit Payment Used', required: true, section: 'principal', reference: 'Payment', inputMode: 'search' },
  { key: 'amount', column: 'Amount', type: 'number', label: 'Amount', required: true, section: 'principal', defaultValue: '0' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency', required: true, section: 'principal', reference: 'Currency', inputMode: 'selector' },
];
// @sf-generated-end fields:usedCreditSource

// @sf-generated-start component:UsedCreditSourceForm
export default function UsedCreditSourceForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
UsedCreditSourceForm.hasCollapsedFields = false;
// @sf-generated-end component:UsedCreditSourceForm
