import CommissionPage from './CommissionPage';

const windowMeta = { category: 'sales', name: 'Commission' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <CommissionPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
