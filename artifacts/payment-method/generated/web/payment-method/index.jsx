import PaymentMethodPage, { api } from './PaymentMethodPage';

const windowMeta = { category: 'settings', name: 'Payment Method' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <PaymentMethodPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
