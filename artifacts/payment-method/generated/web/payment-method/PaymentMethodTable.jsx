import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:paymentMethod
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name' },
  { key: 'description', column: 'Description', type: 'string', label: 'Description' },
];
// @sf-generated-end columns:paymentMethod

const filters = ['name'];

// @sf-generated-start component:PaymentMethodTable
export default function PaymentMethodTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:PaymentMethodTable
