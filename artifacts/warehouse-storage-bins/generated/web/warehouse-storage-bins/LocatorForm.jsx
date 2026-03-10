import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'searchKey', column: 'Value', type: 'text', required: true },
  { key: 'x', column: 'X', type: 'text' },
  { key: 'y', column: 'Y', type: 'text' },
  { key: 'z', column: 'Z', type: 'text' },
  { key: 'priorityNo', column: 'PriorityNo', type: 'number' },
  { key: 'isDefault', column: 'IsDefault', type: 'checkbox', required: true },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function LocatorForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
