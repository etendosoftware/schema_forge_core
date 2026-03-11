import QuotationPage from './QuotationPage';

const windowMeta = { category: 'sales', name: 'Sales Quotation' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <QuotationPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
