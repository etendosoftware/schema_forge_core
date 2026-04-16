import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:internalConsumption
const columns = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date' },
  { key: 'name', column: 'Name', type: 'string', label: 'Name' },
  { key: 'status', column: 'Status', type: 'status', label: 'Status' },
];
// @sf-generated-end columns:internalConsumption

const filters = ['name'];

// @sf-generated-start component:InternalConsumptionTable
export default function InternalConsumptionTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InternalConsumptionTable
