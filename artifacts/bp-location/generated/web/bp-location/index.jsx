import BpLocationPage from './BpLocationPage';

const windowMeta = { category: 'reference', name: 'BP Location' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <BpLocationPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
// @sf-generated-end component:App
