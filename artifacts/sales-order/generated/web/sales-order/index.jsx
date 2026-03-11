import OrderPage from './OrderPage';

const windowMeta = { category: 'sales', name: 'Sales Order' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <OrderPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
