import PackingPage from './PackingPage';

const windowMeta = { category: 'warehouse', name: 'Packing' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <PackingPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
