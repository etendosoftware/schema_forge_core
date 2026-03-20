import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:finPayment
const columns = [
  { key: 'referenceNo', column: 'Referenceno', type: 'string' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'string' },
  { key: 'description', column: 'Description', type: 'string' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'string' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'account', column: 'Fin_Financial_Account_ID', type: 'string' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'financialTransactionAmount', column: 'Finacc_Txn_Amount', type: 'amount' },
  { key: 'financialTransactionConvertRate', column: 'Finacc_Txn_Convert_Rate', type: 'string' },
  { key: 'aPRMAddScheduledpayments', column: 'EM_Aprm_Add_Scheduledpayments', type: 'string' },
  { key: 'aPRMProcessPayment', column: 'EM_APRM_Process_Payment', type: 'string' },
  { key: 'aprmExecutepayment', column: 'EM_Aprm_Executepayment', type: 'string' },
  { key: 'reversedPayment', column: 'FIN_Rev_Payment_ID', type: 'string' },
  { key: 'project', column: 'C_Project_ID', type: 'string' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'string' },
  { key: 'stDimension', column: 'User1_ID', type: 'string' },
  { key: 'ndDimension', column: 'User2_ID', type: 'string' },
];
// @sf-generated-end columns:finPayment

const filters = ['referenceNo', 'paymentDate', 'businessPartner', 'description', 'paymentMethod', 'amount', 'account', 'currency', 'financialTransactionAmount', 'financialTransactionConvertRate', 'aPRMAddScheduledpayments', 'aPRMProcessPayment', 'aprmExecutepayment', 'reversedPayment', 'project', 'costCenter', 'stDimension', 'ndDimension'];

// @sf-generated-start component:FinPaymentTable
export default function FinPaymentTable(props) {
  // @sf-custom-slot hooks:FinPaymentTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:FinPaymentTable

// @sf-custom-slot section:FinPaymentTable-custom
