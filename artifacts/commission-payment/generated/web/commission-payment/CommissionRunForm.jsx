import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'commission', label: 'Commission', type: 'selector', required: true, reference: 'Commission', inputMode: 'selector' },
  { key: 'startDate', label: 'Start Date', type: 'date', required: true },
  { key: 'endDate', label: 'End Date', type: 'date' },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function CommissionRunForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
