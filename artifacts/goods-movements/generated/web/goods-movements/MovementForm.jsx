import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:movement
const fields = [
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true },
];
// @sf-generated-end fields:movement

// @sf-generated-start component:MovementForm
export default function MovementForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:MovementForm
