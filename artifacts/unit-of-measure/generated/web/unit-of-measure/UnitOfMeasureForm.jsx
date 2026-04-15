import { EntityForm } from '@/components/contract-ui';

const UOM_TYPE_OPTIONS = [
  { value: 'A', label: 'Área' },
  { value: 'L', label: 'Longitud' },
  { value: 'T', label: 'Tiempo' },
  { value: 'V', label: 'Volumen' },
  { value: 'W', label: 'Peso' },
];

// @sf-generated-start fields:unitOfMeasure
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'symbol', column: 'UOMSymbol', type: 'text', section: 'principal' },
  { key: 'uOMType', column: 'UOM_Type', type: 'select', options: UOM_TYPE_OPTIONS, section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', section: 'principal' },
];
// @sf-generated-end fields:unitOfMeasure

// @sf-generated-start component:UnitOfMeasureForm
export default function UnitOfMeasureForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:UnitOfMeasureForm
