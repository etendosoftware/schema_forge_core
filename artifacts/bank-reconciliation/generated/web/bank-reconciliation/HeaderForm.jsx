import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:header
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'other' },
  { key: 'transactionDate', column: 'TransactionDate', type: 'date', label: 'Transaction Date', required: true, readOnly: true, section: 'other' },
  { key: 'endingBalance', column: 'EndingBalance', type: 'number', label: 'Ending Balance', readOnly: true, section: 'other' },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', label: 'Document Status', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:header

// @sf-generated-start component:HeaderForm
export default function HeaderForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:HeaderForm
