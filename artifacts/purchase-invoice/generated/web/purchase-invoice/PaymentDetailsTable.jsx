import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:paymentDetails
const columns = [
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'invoicePaid', column: 'Isinvoicepaid', type: 'boolean' },
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
