import CustomerReturnPage from './CustomerReturnPage';

const windowMeta = { category: 'sales', name: 'Return from Customer' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <CustomerReturnPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
