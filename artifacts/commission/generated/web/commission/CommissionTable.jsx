import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'frequencyType', column: 'FrequencyType', type: 'string' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
  { key: 'dateLastRun', column: 'DateLastRun', type: 'date' },
];

const filters = ['name', 'businessPartner', 'frequencyType'];

export default function CommissionTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
