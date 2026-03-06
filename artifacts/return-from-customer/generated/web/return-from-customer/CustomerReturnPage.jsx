import { MasterDetailPage } from '@/components/contract-ui';
import CustomerReturnTable from './CustomerReturnTable';
import CustomerReturnForm from './CustomerReturnForm';
import CustomerReturnLineTable from './CustomerReturnLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'totalAmount', label: 'Total Amount', type: 'amount' },
  { key: 'isApproved', label: 'Is Approved', type: 'boolean' },
];

const statusField = 'docStatus';

const processes = [
  { name: 'DocAction_Process', label: 'Doc Action_ Process', style: 'positive' },
];

const addLineFields = {
  entry: [
    { key: 'originalShipmentLine', label: 'Original Shipment Line', type: 'selector', required: true, lookup: true, reference: 'ShipmentLine', inputMode: 'selector' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'lineNo', label: 'Line No', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'text' },
  ],
  derived: [

  ],
};

export default function CustomerReturnPage(props) {
  return (
    <MasterDetailPage
      entity="customerReturn"
      detailEntity="customerReturnLine"
      Table={CustomerReturnTable}
      Form={CustomerReturnForm}
      DetailTable={CustomerReturnLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Customer Return"
      detailLabel="Customer Return Line"
      {...props}
    />
  );
}
