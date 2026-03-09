import { MasterDetailPage } from '@/components/contract-ui';
import ReturnReceiptTable from './ReturnReceiptTable';
import ReturnReceiptForm from './ReturnReceiptForm';
import ReturnReceiptLineTable from './ReturnReceiptLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
];

const statusField = 'docStatus';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'product', label: 'Product', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'movementQty', label: 'Movement Qty', type: 'number', required: true },
    { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'lineNo', label: 'Line No', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'returnOrderLine', label: 'Return Order Line', type: 'dependent', reference: 'SalesOrderLine', inputMode: 'dependent', dependsOn: { field: 'returnReceipt.orderReference', filterKey: 'cOrderId' } },
    { key: 'rmaLine', label: 'Rma Line', type: 'dependent', reference: 'ReturnMaterialAuthorizationLine', inputMode: 'dependent', dependsOn: { field: 'returnReceipt.returnReason', filterKey: 'mRmaId' } },
  ],
  derived: [

  ],
};

export default function ReturnReceiptPage(props) {
  return (
    <MasterDetailPage
      entity="returnReceipt"
      detailEntity="returnReceiptLine"
      Table={ReturnReceiptTable}
      Form={ReturnReceiptForm}
      DetailTable={ReturnReceiptLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Return Receipt"
      detailLabel="Return Receipt Line"
      {...props}
    />
  );
}
