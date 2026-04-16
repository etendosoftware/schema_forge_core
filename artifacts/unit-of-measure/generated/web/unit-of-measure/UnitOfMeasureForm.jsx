import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:unitOfMeasure
const fields = [
  { key: 'eDICode', column: 'X12DE355', type: 'text', required: true, section: 'principal' },
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'symbol', column: 'UOMSymbol', type: 'text', section: 'principal' },
  { key: 'standardPrecision', column: 'StdPrecision', type: 'number', required: true, section: 'principal' },
  { key: 'costingPrecision', column: 'CostingPrecision', type: 'number', required: true, section: 'principal' },
  { key: 'default', column: 'IsDefault', type: 'checkbox', section: 'principal' },
];
// @sf-generated-end fields:unitOfMeasure

// @sf-generated-start component:UnitOfMeasureForm
export default function UnitOfMeasureForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:UnitOfMeasureForm
