import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:finPayment
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'referenceNo', column: 'Referenceno', type: 'string' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'string' },
  { key: 'description', column: 'Description', type: 'string' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'string' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'string' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
];
// @sf-generated-end columns:finPayment

const filters = ['documentNo', 'referenceNo', 'paymentDate', 'businessPartner', 'description', 'paymentMethod', 'amount', 'account', 'currency'];

// @sf-generated-start component:FinPaymentTable
export default function FinPaymentTable(props) {
  // @sf-custom-slot hooks:FinPaymentTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:FinPaymentTable

// @sf-custom-slot section:FinPaymentTable-custom
