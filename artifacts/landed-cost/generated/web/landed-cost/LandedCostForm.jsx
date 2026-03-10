import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'organization', column: 'AD_Org_ID', type: 'selector', required: true, reference: 'Organization', inputMode: 'selector' },
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
];

export default function LandedCostForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
