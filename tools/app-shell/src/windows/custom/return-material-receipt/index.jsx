import ReturnMaterialReceiptPage from '@generated/return-material-receipt/generated/web/return-material-receipt/ReturnMaterialReceiptPage';
import ReturnMaterialReceiptPreview from './ReturnMaterialReceiptPreview';
import ReturnWindowShell from '../shared/ReturnWindowShell';

export default function ReturnMaterialReceiptWindow({ windowName, recordId, apiBaseUrl, token, ...rest }) {
  return (
    <ReturnWindowShell
      windowName={windowName}
      recordId={recordId}
      apiBaseUrl={apiBaseUrl}
      token={token}
      PageComponent={ReturnMaterialReceiptPage}
      renderPreview={({ row, onClose, onEdit }) => (
        <ReturnMaterialReceiptPreview
          receipt={row}
          token={token}
          apiBaseUrl={apiBaseUrl}
          windowName={windowName}
          onClose={onClose}
          onEdit={onEdit}
        />
      )}
      entity="returnMaterialReceipt"
      headerEntity="returnMaterialReceipt"
      routePrefix="/return-material-receipt/"
      duplicateAction={{ show: true, visibleWhen: "@documentStatus@='CO'" }}
      {...rest}
    />
  );
}
