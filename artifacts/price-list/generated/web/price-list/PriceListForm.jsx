import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'currency', column: 'C_Currency_ID', type: 'text', required: true },
  { key: 'isDefault', column: 'IsDefault', type: 'checkbox' },
  { key: 'isSalesPrice', column: 'IsSOPriceList', type: 'checkbox', readOnly: true },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function PriceListForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
