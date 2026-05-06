import CabeceraDeConfiguraciónVerifactuPage, { api } from './CabeceraDeConfiguraciónVerifactuPage';

const windowMeta = { category: 'configuration', name: 'Verifactu Config' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <CabeceraDeConfiguraciónVerifactuPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
