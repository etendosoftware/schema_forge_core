import BusinessPartnerPage from './BusinessPartnerPage';

const windowMeta = { category: 'reference', name: 'Business Partner' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <BusinessPartnerPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
