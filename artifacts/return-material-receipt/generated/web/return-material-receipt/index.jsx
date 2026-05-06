import ReturnMaterialReceiptPage, { api } from './ReturnMaterialReceiptPage';

const windowMeta = { category: 'sales', name: 'Return Material Receipt' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <ReturnMaterialReceiptPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
