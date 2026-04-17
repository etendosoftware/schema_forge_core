import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:intrastatShipments
const columns = [

];
// @sf-generated-end columns:intrastatShipments

const filters = [];

// @sf-generated-start component:IntrastatShipmentsTable
export default function IntrastatShipmentsTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:IntrastatShipmentsTable
