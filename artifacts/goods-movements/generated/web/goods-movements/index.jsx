import GoodsMovementPage from './GoodsMovementPage';

const windowMeta = { category: 'warehouseManagement', name: 'Goods Movements' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <GoodsMovementPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
