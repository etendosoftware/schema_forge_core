import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:order
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
];
// @sf-generated-end columns:order

const filters = ['orderDate', 'businessPartner', 'orderReference'];

// @sf-generated-start component:OrderTable
export default function OrderTable(props) {
  // @sf-custom-slot hooks:OrderTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:OrderTable

// @sf-custom-slot section:OrderTable-custom
