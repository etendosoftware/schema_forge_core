import { MasterDetailPage } from '@/components/contract-ui';
import ReturnMaterialTable from './ReturnMaterialTable';
import ReturnMaterialForm from './ReturnMaterialForm';
import ReturnMaterialLineTable from './ReturnMaterialLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'totalAmount', column: 'Amt', type: 'amount' },
  { key: 'isApproved', column: 'IsApproved', type: 'boolean' },
];

const statusField = 'docStatus';

const processes = [
  { name: 'DocAction_Process', label: 'Doc Action_ Process', style: 'positive' },
];

const addLineFields = {
  entry: [
    { key: 'originalReceiptLine', column: 'M_InOutLine_ID', type: 'selector', required: true, lookup: true, reference: 'MaterialReceiptLine', inputMode: 'selector' },
    { key: 'quantity', column: 'Qty', type: 'number', required: true },
    { key: 'lineNo', column: 'Line', type: 'number', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
  ],
  derived: [

  ],
};

export default function ReturnMaterialPage(props) {
  return (
    <MasterDetailPage
      entity="returnMaterial"
      detailEntity="returnMaterialLine"
      Table={ReturnMaterialTable}
      Form={ReturnMaterialForm}
      DetailTable={ReturnMaterialLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Return Material"
      detailLabel="Return Material Line"
      {...props}
    />
  );
}
