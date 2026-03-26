import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpartnerDocType
const fields = [
  // @sf-custom-slot callout:BusinessPartnerDocTypeValidation
  { key: 'documentcategory', column: 'Documentcategory', type: 'text', required: true, section: 'principal' },
  // @sf-custom-slot callout:BusinessPartnerDocTypeValidation
  { key: 'issotrx', column: 'Issotrx', type: 'checkbox', required: true, section: 'principal' },
  { key: 'cDoctypeID', column: 'C_Doctype_ID', type: 'selector', required: true, section: 'principal', reference: 'DocType', inputMode: 'selector' },
  { key: 'active', column: 'Isactive', type: 'checkbox', required: true, section: 'principal' },
];
// @sf-generated-end fields:bpartnerDocType

// @sf-generated-start component:BpartnerDocTypeForm
export default function BpartnerDocTypeForm(props) {
  // @sf-custom-slot hooks:BpartnerDocTypeForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpartnerDocTypeForm

// @sf-custom-slot section:BpartnerDocTypeForm-custom
