import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:user
const columns = [
  { key: 'firstName', column: 'Firstname', type: 'string' },
  { key: 'lastName', column: 'Lastname', type: 'string' },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'email', column: 'Email', type: 'string' },
  { key: 'phone', column: 'Phone', type: 'string' },
];
// @sf-generated-end columns:user

const filters = ['name', 'email'];

// @sf-generated-start component:UserTable
export default function UserTable(props) {
  // @sf-custom-slot hooks:UserTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:UserTable

// @sf-custom-slot section:UserTable-custom
