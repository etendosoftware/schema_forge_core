import SincronizacionPage, { api } from './SincronizacionPage';

const windowMeta = { category: 'monitor', name: 'TBAI Facturas Enviadas' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <SincronizacionPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
