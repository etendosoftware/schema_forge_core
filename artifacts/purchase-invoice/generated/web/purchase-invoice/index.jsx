import InvoicePage from './InvoicePage';

const windowMeta = { category: 'procurement', name: 'Purchase Invoice' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <InvoicePage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
