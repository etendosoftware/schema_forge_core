import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:binContents
const columns = [

];
// @sf-generated-end columns:binContents

const filters = [];

// @sf-generated-start component:BinContentsTable
export default function BinContentsTable(props) {
  // @sf-custom-slot hooks:BinContentsTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:BinContentsTable

// @sf-custom-slot section:BinContentsTable-custom
