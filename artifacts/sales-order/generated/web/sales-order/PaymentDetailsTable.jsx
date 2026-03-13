import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:paymentDetails
const columns = [
  { key: 'paymentIn', column: 'FIN_Payment_ID', type: 'string' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date' },
  { key: 'dueDate', column: 'Duedate', type: 'date' },
  { key: 'paymentMethod', column: 'EM_APRM_Displayed_Paymmeth_ID', type: 'string' },
  { key: 'financialAccount', column: 'EM_APRM_Displayed_Acc_ID', type: 'string' },
  { key: 'expectedAmount', column: 'Expected', type: 'amount' },
  { key: 'receivedAmount', column: 'Paidamt', type: 'amount' },
  { key: 'status', column: 'Status', type: 'status' },
];
// @sf-generated-end columns:paymentDetails

const filters = [];

// @sf-generated-start component:PaymentDetailsTable
export default function PaymentDetailsTable(props) {
  // @sf-custom-slot hooks:PaymentDetailsTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:PaymentDetailsTable

// @sf-custom-slot section:PaymentDetailsTable-custom
