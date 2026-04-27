import { useState } from 'react';
import { createPortal } from 'react-dom';
import GeneratedApp from '@generated/sales-quotation/generated/web/sales-quotation/index.jsx';
import QuotationTable from '@generated/sales-quotation/generated/web/sales-quotation/QuotationTable';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import LinesEmptyState from '@/components/contract-ui/LinesEmptyState.jsx';

const QUOTATION_COLUMNS = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', dot: false },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', enumLabels: { 'AE': 'Automatic Evaluation', 'CO': 'Booked', 'CL': 'Closed', 'CA': 'Closed - Order Created', 'CJ': 'Closed - Rejected', 'DR': 'Draft', 'ME': 'Manual Evaluation', 'NA': 'Not Accepted', 'NC': 'Not Confirmed', 'WP': 'Not Paid', 'RE': 'Re-Opened', 'TMP': 'Temporal', 'UE': 'Under Evaluation', 'IP': 'Under Way', '??': 'Unknown', 'VO': 'Voided' } },
  { key: 'validUntil', column: 'validuntil', type: 'date' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
];

const LABEL_OVERRIDES = {
  es_ES: { C_BPartner_ID: 'Contacto', DateOrdered: 'Fecha cotización' },
  en_US: { C_BPartner_ID: 'Contact',  DateOrdered: 'Quotation Date'   },
};

function CustomQuotationTable(props) {
  return <QuotationTable columns={QUOTATION_COLUMNS} {...props} />;
}

export default function SalesQuotationWindow({ windowName, recordId, token, apiBaseUrl, ...rest }) {
  const [cloneTargets, setCloneTargets] = useState(null);

  const { bpApiBaseUrl, headers, createContactState, setCreateContactState, createContactCtxValue } =
    useCreateContactModal({ apiBaseUrl, token });

  if (recordId) {
    return (
      <CreateContactContext.Provider value={createContactCtxValue}>
        <GeneratedApp
          windowName={windowName}
          recordId={recordId}
          token={token}
          apiBaseUrl={apiBaseUrl}
          linesEmptyState={LinesEmptyState}
          addLineGuard={(d) => !!d?.businessPartner}
          {...rest}
        />
        {createContactState && createPortal(
          <CreateContactModal
            bpApiBaseUrl={bpApiBaseUrl}
            headers={headers}
            initialQuery={createContactState.query}
            documentType="sale"
            onClose={() => setCreateContactState(null)}
            onCreated={(newBP) => {
              createContactState.onSelect({ id: newBP.id, name: newBP.name });
              setCreateContactState(null);
            }}
          />,
          document.body,
        )}
      </CreateContactContext.Provider>
    );
  }

  return (
    <>
      <GeneratedApp
        windowName={windowName}
        recordId={recordId}
        token={token}
        apiBaseUrl={apiBaseUrl}
        Table={CustomQuotationTable}
        labelOverrides={LABEL_OVERRIDES}
        onCloneRow={(rowOrRows) => setCloneTargets(Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows])}
        {...rest}
      />
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          headerEntity="quotation"
          routePrefix="/sales-quotation/"
          onClose={() => setCloneTargets(null)}
        />,
        document.body,
      )}
    </>
  );
}
