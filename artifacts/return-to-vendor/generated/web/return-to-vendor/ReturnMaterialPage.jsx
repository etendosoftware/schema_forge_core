import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import ReturnMaterialTable from './ReturnMaterialTable';
import ReturnMaterialForm from './ReturnMaterialForm';
import ReturnMaterialLineTable from './ReturnMaterialLineTable';
import ReturnMaterialLineForm from './ReturnMaterialLineForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import catalogs from './mockCatalogs';


const breadcrumb = 'Purchases / Return to Vendor';


// @sf-generated-start summary:returnMaterial
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'totalAmount', column: 'Amt', type: 'amount' },
  { key: 'isApproved', column: 'IsApproved', type: 'boolean' },
];

const statusField = 'docStatus';
// @sf-generated-end summary:returnMaterial

// @sf-generated-start extraBadges:returnMaterial
const extraBadges = [];
// @sf-generated-end extraBadges:returnMaterial

// @sf-generated-start processes:returnMaterial
const processes = [
  { name: 'DocAction_Process', label: 'Doc Action_ Process', style: 'positive' },
];
// @sf-generated-end processes:returnMaterial

// @sf-generated-start draftMode:returnMaterial
const draftMode = null;
// @sf-generated-end draftMode:returnMaterial

// @sf-generated-start addLineFields:returnMaterialLine
const addLineFields = {
  entry: [
    { key: 'originalReceiptLine', column: 'M_InOutLine_ID', type: 'selector', required: true, reference: 'MaterialReceiptLine', inputMode: 'selector' },
    { key: 'quantity', column: 'Qty', type: 'number', required: true },
    { key: 'lineNo', column: 'Line', type: 'number', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
  ],
  derived: [

  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:returnMaterialLine

// @sf-generated-start component:ReturnMaterialPage
export default function ReturnMaterialPage({ windowName, recordId, ...props }) {
  
  if (recordId) {
    return (
      <DetailView
        entity="returnMaterial"
        detailEntity="returnMaterialLine"
        Form={ReturnMaterialForm}
        DetailTable={ReturnMaterialLineTable}
        DetailForm={ReturnMaterialLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Return Material"
        detailLabel="Return Material Line"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
        notesField="returnReason"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }]}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="returnMaterial"
      Table={ReturnMaterialTable}
      entityLabel="Return to Vendor"
      windowName={windowName}
      breadcrumb={breadcrumb}
      {...props}
    />
  );
}
// @sf-generated-end component:ReturnMaterialPage
