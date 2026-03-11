import WarehousePickingListPage from './WarehousePickingListPage';

const windowMeta = { category: 'warehouse', name: 'Warehouse Picking List' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <WarehousePickingListPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
