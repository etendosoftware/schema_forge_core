import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'searchKey', label: 'Search Key', type: 'text', required: true },
  { key: 'x', label: 'X', type: 'text' },
  { key: 'y', label: 'Y', type: 'text' },
  { key: 'z', label: 'Z', type: 'text' },
  { key: 'priorityNo', label: 'Priority No', type: 'number' },
  { key: 'isDefault', label: 'Is Default', type: 'checkbox', required: true },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function LocatorForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
