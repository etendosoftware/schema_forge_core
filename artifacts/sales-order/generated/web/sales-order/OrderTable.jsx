import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:order
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'deliveryStatus', column: 'DeliveryStatus', type: 'percent' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent' },
];
// @sf-generated-end columns:order

const filters = ['documentNo', 'orderDate', 'businessPartner', 'documentStatus', 'orderReference'];

// @sf-generated-start component:OrderTable
export default function OrderTable(props) {
  // @sf-custom-slot hooks:OrderTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:OrderTable

// @sf-custom-slot section:OrderTable-custom
