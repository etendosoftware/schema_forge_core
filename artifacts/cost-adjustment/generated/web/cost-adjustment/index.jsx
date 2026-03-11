import CostAdjustmentPage from './CostAdjustmentPage';

const windowMeta = { category: 'warehouse', name: 'Cost Adjustment' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <CostAdjustmentPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
