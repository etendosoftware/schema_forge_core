import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'productionQuantity', column: 'ProductionQty', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
];

export default function ProductionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
