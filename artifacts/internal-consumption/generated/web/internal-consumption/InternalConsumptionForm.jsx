import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:internalConsumption
const fields = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
];
// @sf-generated-end fields:internalConsumption

// @sf-generated-start component:InternalConsumptionForm
export default function InternalConsumptionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
InternalConsumptionForm.hasCollapsedFields = false;
// @sf-generated-end component:InternalConsumptionForm
