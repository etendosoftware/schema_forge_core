import WarehousePage from './WarehousePage';

const windowMeta = { category: 'setup', name: 'Warehouse Storage Bins' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <WarehousePage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
