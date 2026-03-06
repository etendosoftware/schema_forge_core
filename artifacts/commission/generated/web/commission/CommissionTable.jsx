import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'currency', label: 'Currency', type: 'string' },
  { key: 'frequencyType', label: 'Frequency Type', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
  { key: 'dateLastRun', label: 'Date Last Run', type: 'date' },
];

const filters = ['name', 'businessPartner', 'frequencyType'];

export default function CommissionTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
