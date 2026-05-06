import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:tax
const fields = [
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'rate', column: 'Rate', type: 'number', label: 'Rate', required: true, section: 'principal' },
  { key: 'salesPurchaseType', column: 'SOPOType', type: 'select', label: 'Sales/Purchase Type', required: true, section: 'principal', options: [{ value: 'B', label: 'Both' }, { value: 'P', label: 'Purchase Tax' }, { value: 'S', label: 'Sales Tax' }], defaultValue: 'B' },
  { key: 'validFromDate', column: 'ValidFrom', type: 'date', label: 'Valid From Date', required: true, section: 'principal' },
  { key: 'docTaxAmount', column: 'DocTaxAmount', type: 'select', label: 'Document Tax Amount Calculation', required: true, section: 'principal', options: [{ value: 'D', label: 'Document based amount by rate' }, { value: 'L', label: 'Line based amount by rate' }], defaultValue: 'D' },
  { key: 'baseAmount', column: 'BaseAmount', type: 'select', label: 'Base Amount', required: true, section: 'principal', options: [{ value: 'TBA', label: 'Alternate Tax Base Amount' }, { value: 'TBATAX', label: 'Alternate Tax Base Amount + Tax Amount' }, { value: 'LNA', label: 'Line Net Amount' }, { value: 'LNATAX', label: 'Line Net Amount + Tax Amount' }, { value: 'TAX', label: 'Tax Amount' }], defaultValue: 'LNA' },
];
// @sf-generated-end fields:tax

// @sf-generated-start component:TaxForm
export default function TaxForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:TaxForm
