import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:storageBin
const columns = [

];
// @sf-generated-end columns:storageBin

const filters = [];

// @sf-generated-start component:StorageBinTable
export default function StorageBinTable(props) {
  // @sf-custom-slot hooks:StorageBinTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:StorageBinTable

// @sf-custom-slot section:StorageBinTable-custom
