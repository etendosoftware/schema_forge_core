import { EntityForm } from '@/components/contract-ui';

const APPLICABLE_TO_OPTIONS = [
  { value: 'B', label: 'Both' },
  { value: 'S', label: 'Sales Tax' },
  { value: 'P', label: 'Purchase Tax' },
];

const DOC_TAX_AMOUNT_OPTIONS = [
  { value: 'D', label: 'Document Amount' },
  { value: 'L', label: 'Line Amount' },
];

const BASE_AMOUNT_OPTIONS = [
  { value: 'LNA', label: 'Line Net Amount' },
  { value: 'LNATAX', label: 'Line Net Amount + Tax' },
  { value: 'TAX', label: 'Tax Amount' },
  { value: 'TBA', label: 'Alternative Base Amount' },
  { value: 'TBATAX', label: 'Alternative Base + Tax' },
];

// @sf-generated-start fields:tax
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'rate', column: 'Rate', type: 'number', required: true, section: 'principal' },
  { key: 'applicableTo', column: 'SOPOType', type: 'select', options: APPLICABLE_TO_OPTIONS, section: 'principal' },
  { key: 'validFrom', column: 'ValidFrom', type: 'date', section: 'principal' },
  { key: 'docTaxAmount', column: 'DocTaxAmount', type: 'select', options: DOC_TAX_AMOUNT_OPTIONS, required: true, section: 'principal' },
  { key: 'baseAmount', column: 'BaseAmount', type: 'select', options: BASE_AMOUNT_OPTIONS, required: true, section: 'principal' },
];
// @sf-generated-end fields:tax

// @sf-generated-start component:TaxForm
export default function TaxForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:TaxForm
