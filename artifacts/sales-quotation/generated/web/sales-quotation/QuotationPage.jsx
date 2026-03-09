import { MasterDetailPage } from '@/components/contract-ui';
import QuotationTable from './QuotationTable';
import QuotationForm from './QuotationForm';
import QuotationLineTable from './QuotationLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'grandTotal', label: 'Grand Total', type: 'amount' },
  { key: 'totalLines', label: 'Total Lines', type: 'amount' },
  { key: 'currency', label: 'Currency', type: 'string' },
];

const statusField = 'docStatus';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'product', label: 'Product', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  ],
  derived: [
    { key: 'unitPrice', label: 'Unit Price', type: 'number' },
    { key: 'tax', label: 'Tax', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'discount', label: 'Discount', type: 'number' },
  ],
};

export default function QuotationPage(props) {
  return (
    <MasterDetailPage
      entity="quotation"
      detailEntity="quotationLine"
      Table={QuotationTable}
      Form={QuotationForm}
      DetailTable={QuotationLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Quotation"
      detailLabel="Quotation Line"
      {...props}
    />
  );
}
