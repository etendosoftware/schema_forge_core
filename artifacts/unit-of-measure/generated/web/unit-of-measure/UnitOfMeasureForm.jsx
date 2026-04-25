import { EntityForm } from '@/components/contract-ui';
import { useUI } from '@/i18n';

// @sf-generated-start fields:unitOfMeasure
const BASE_FIELDS = [
  { key: 'eDICode', column: 'X12DE355', type: 'text', required: true, section: 'principal' },
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'symbol', column: 'UOMSymbol', type: 'text', section: 'principal' },
  { key: 'standardPrecision', column: 'StdPrecision', type: 'number', required: true, section: 'principal' },
  { key: 'costingPrecision', column: 'CostingPrecision', type: 'number', required: true, section: 'principal' },
  { key: 'default', column: 'IsDefault', type: 'checkbox', section: 'principal' },
  { key: 'uOMType', column: 'UOM_Type', type: 'select', section: 'principal' },
];
// @sf-generated-end fields:unitOfMeasure

// @sf-generated-start component:UnitOfMeasureForm
export default function UnitOfMeasureForm(props) {
  const ui = useUI();
  const fields = BASE_FIELDS.map((f) => {
    if (f.key !== 'uOMType') return f;
    return {
      ...f,
      options: [
        { value: 'A', label: ui('uomTypeArea') },
        { value: 'L', label: ui('uomTypeLength') },
        { value: 'T', label: ui('uomTypeTime') },
        { value: 'V', label: ui('uomTypeVolume') },
        { value: 'W', label: ui('uomTypeWeight') },
      ],
    };
  });
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:UnitOfMeasureForm
