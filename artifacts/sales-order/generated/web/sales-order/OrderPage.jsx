import { MasterDetailPage } from '@/components/contract-ui';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'currency', label: 'Currency', type: 'string' },
  { key: 'totalLines', label: 'Total Lines', type: 'amount' },
  { key: 'grandTotal', label: 'Grand Total', type: 'amount' },
];

const statusField = 'docStatus';

const processes = [
  { name: 'completeOrder', label: 'Complete Order', style: 'positive' },
  { name: 'voidOrder', label: 'Void Order', style: 'destructive' },
];

const addLineFields = {
  entry: [
    { key: 'product', label: 'Product', type: 'text', required: true, lookup: true },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'text' },
  ],
  derived: [
    { key: 'unitPrice', label: 'Unit Price', type: 'number' },
    { key: 'discount', label: 'Discount', type: 'number' },
    { key: 'tax', label: 'Tax', type: 'text' },
  ],
};

export default function OrderPage(props) {
  return (
    <MasterDetailPage
      entity="order"
      detailEntity="orderLine"
      Table={OrderTable}
      Form={OrderForm}
      DetailTable={OrderLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      entityLabel="Order"
      detailLabel="Order Line"
      {...props}
    />
  );
}
