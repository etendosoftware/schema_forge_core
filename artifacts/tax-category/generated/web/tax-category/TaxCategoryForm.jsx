import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:taxCategory
const fields = [
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
  { key: 'default', column: 'IsDefault', type: 'checkbox', label: 'Default', required: true, section: 'principal' },
  { key: 'asbom', column: 'Asbom', type: 'checkbox', label: 'As per BOM', required: true, section: 'principal' },
  { key: 'obsptiTaxtype', column: 'EM_Obspti_Taxtype', type: 'select', label: 'Tax type', section: 'principal', options: [{ value: 'IGIC', label: 'IGIC' }, { value: 'IPSI', label: 'IPSI' }, { value: 'IVA', label: 'IVA' }, { value: 'VAT', label: 'VAT' }] },
  { key: 'obsptiTransactiontype', column: 'EM_Obspti_Transactiontype', type: 'select', label: 'Transaction type', section: 'principal', options: [{ value: 'BI', label: 'Entrega/Adquisición de bienes' }, { value: 'SE', label: 'Prestación de Servicios' }, { value: 'IN', label: 'Transmisión/Adquisición B.Inmuebles' }] },
  { key: 'obsptiRatetype', column: 'EM_Obspti_Ratetype', type: 'select', label: 'Rate type', section: 'principal', options: [{ value: 'CE', label: 'Cero' }, { value: 'EX', label: 'Exento' }, { value: 'GE', label: 'General' }, { value: 'I1', label: 'Incrementado 1' }, { value: 'I2', label: 'Incrementado 2' }, { value: 'NS', label: 'No sujeto' }, { value: 'NO', label: 'Normal' }, { value: 'RE', label: 'Reducido' }, { value: 'SR', label: 'Super reducido' }] },
  { key: 'aeatsiiDeclarable', column: 'EM_Aeatsii_Declarable', type: 'checkbox', label: 'SII declarable', required: true, section: 'principal', defaultValue: 'Y' },
];
// @sf-generated-end fields:taxCategory

// @sf-generated-start component:TaxCategoryForm
export default function TaxCategoryForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:TaxCategoryForm
