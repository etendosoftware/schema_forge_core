import ReturnReceiptPage from './ReturnReceiptPage';

const windowMeta = { category: 'sales', name: 'Return Material Receipt' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <ReturnReceiptPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
