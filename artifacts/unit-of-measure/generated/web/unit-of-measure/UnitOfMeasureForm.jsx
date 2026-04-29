import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:unitOfMeasure
const fields = [
  { key: 'eDICode', column: 'X12DE355', type: 'text', label: 'EDI Code', required: true, section: 'principal' },
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'symbol', column: 'UOMSymbol', type: 'text', label: 'Symbol', section: 'principal' },
  { key: 'standardPrecision', column: 'StdPrecision', type: 'number', label: 'Standard Precision', required: true, section: 'principal' },
  { key: 'costingPrecision', column: 'CostingPrecision', type: 'number', label: 'Costing Precision', required: true, section: 'principal' },
  { key: 'default', column: 'IsDefault', type: 'checkbox', label: 'Default', required: true, section: 'principal' },
  { key: 'uOMType', column: 'UOM_Type', type: 'select', label: 'UOM Type', section: 'principal', options: [{ value: 'A', label: 'Area' }, { value: 'L', label: 'Length' }, { value: 'T', label: 'Time' }, { value: 'V', label: 'Volume' }, { value: 'W', label: 'Weight' }] },
];
// @sf-generated-end fields:unitOfMeasure

// @sf-generated-start component:UnitOfMeasureForm
export default function UnitOfMeasureForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:UnitOfMeasureForm
