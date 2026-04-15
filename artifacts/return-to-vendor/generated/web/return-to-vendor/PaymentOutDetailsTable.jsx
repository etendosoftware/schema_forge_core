import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:paymentOutDetails
const columns = [

];
// @sf-generated-end columns:paymentOutDetails

const filters = [];

// @sf-generated-start component:PaymentOutDetailsTable
export default function PaymentOutDetailsTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:PaymentOutDetailsTable
