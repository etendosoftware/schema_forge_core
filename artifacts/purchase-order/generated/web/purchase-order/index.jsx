import OrderPage from './OrderPage';

const windowMeta = { category: 'procurement', name: 'Purchase Order' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <OrderPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
