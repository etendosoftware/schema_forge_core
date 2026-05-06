import UnitOfMeasurePage, { api } from './UnitOfMeasurePage';

const windowMeta = { category: 'settings', name: 'Unit of Measure' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <UnitOfMeasurePage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
