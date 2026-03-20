import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'locator', column: 'M_Locator_ID', type: 'string' },
  { key: 'quantity', column: 'Quantity', type: 'number' },
  { key: 'released', column: 'Released', type: 'number' },
  { key: 'isAllocated', column: 'IsAllocated', type: 'boolean' },
];

const filters = ['locator'];

export default function ReservationStockTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
