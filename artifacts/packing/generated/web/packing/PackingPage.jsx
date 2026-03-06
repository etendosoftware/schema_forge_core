import { MasterDetailPage } from '@/components/contract-ui';
import PackingTable from './PackingTable';
import PackingForm from './PackingForm';
import PackingLineTable from './PackingLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
];

const statusField = 'docStatus';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'lineNo', label: 'Line No', type: 'number', required: true, lookup: true },
    { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'weight', label: 'Weight', type: 'number' },
    { key: 'packageNo', label: 'Package No', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'text' },
  ],
  derived: [

  ],
};

export default function PackingPage(props) {
  return (
    <MasterDetailPage
      entity="packing"
      detailEntity="packingLine"
      Table={PackingTable}
      Form={PackingForm}
      DetailTable={PackingLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Packing"
      detailLabel="Packing Line"
      {...props}
    />
  );
}
