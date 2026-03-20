import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:header
const columns = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'orderReference', column: 'POReference', type: 'string' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'string' },
  { key: 'delivered', column: 'IsDelivered', type: 'boolean' },
];
// @sf-generated-end columns:header

const filters = ['orderDate', 'businessPartner', 'orderReference'];

// @sf-generated-start component:HeaderTable
export default function HeaderTable(props) {
  // @sf-custom-slot hooks:HeaderTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:HeaderTable

// @sf-custom-slot section:HeaderTable-custom
