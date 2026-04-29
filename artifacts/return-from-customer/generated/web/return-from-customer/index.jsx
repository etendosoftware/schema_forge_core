import CustomerReturnPage, { api } from './CustomerReturnPage';

const windowMeta = { category: 'sales', name: 'Return from Customer' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <CustomerReturnPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
