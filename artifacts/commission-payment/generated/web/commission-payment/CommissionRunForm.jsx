import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'commission', column: 'C_Commission_ID', type: 'selector', required: true, reference: 'Commission', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true },
  { key: 'endDate', column: 'EndDate', type: 'date' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
];

export default function CommissionRunForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
