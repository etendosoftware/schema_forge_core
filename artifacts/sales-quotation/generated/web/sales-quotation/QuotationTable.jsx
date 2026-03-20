import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:quotation
const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
];
// @sf-generated-end columns:quotation

const filters = ['businessPartner', 'orderDate', 'scheduledDeliveryDate', 'documentNo', 'documentStatus'];

// @sf-generated-start component:QuotationTable
export default function QuotationTable(props) {
  // @sf-custom-slot hooks:QuotationTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:QuotationTable

// @sf-custom-slot section:QuotationTable-custom
