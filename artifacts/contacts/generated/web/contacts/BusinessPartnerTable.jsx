import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:businessPartner
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Commercial Name' },
  { key: 'etgoWeb', column: 'EM_Etgo_Web', type: 'string', label: 'Web' },
  { key: 'etgoEmail', column: 'EM_Etgo_Email', type: 'string', label: 'Email' },
  { key: 'etgoPhone', column: 'EM_Etgo_Phone', type: 'string', label: 'Phone' },
  { key: 'customer', column: 'IsCustomer', type: 'boolean', label: 'Customer' },
  { key: 'vendor', column: 'IsVendor', type: 'boolean', label: 'Vendor' },
];
// @sf-generated-end columns:businessPartner

const filters = ['name'];

// @sf-generated-start component:BusinessPartnerTable
export default function BusinessPartnerTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:BusinessPartnerTable
