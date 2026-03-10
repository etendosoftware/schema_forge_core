import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'stage', column: 'Stage', type: 'string' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'probability', column: 'Probability', type: 'number' },
  { key: 'expectedCloseDate', column: 'ExpectedCloseDate', type: 'date' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'string' },
  { key: 'source', column: 'Source', type: 'string' },
];

const filters = ['name', 'businessPartner', 'stage'];

export default function DealTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
