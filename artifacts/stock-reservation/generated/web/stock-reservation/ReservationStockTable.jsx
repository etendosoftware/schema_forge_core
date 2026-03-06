import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'locator', label: 'Locator', type: 'string' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'released', label: 'Released', type: 'number' },
  { key: 'isAllocated', label: 'Is Allocated', type: 'boolean' },
];

const filters = ['locator'];

export default function ReservationStockTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
