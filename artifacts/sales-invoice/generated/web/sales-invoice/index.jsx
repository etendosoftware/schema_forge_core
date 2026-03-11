import InvoicePage from './InvoicePage';

const windowMeta = { category: 'sales', name: 'Sales Invoice' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <InvoicePage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
