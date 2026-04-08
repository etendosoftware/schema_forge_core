import GoodsMovementPage from './GoodsMovementPage';

const windowMeta = { category: 'inventory', name: 'Goods Movements' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <GoodsMovementPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
