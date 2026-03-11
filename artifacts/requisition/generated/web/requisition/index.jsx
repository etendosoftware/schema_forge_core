import RequisitionPage from './RequisitionPage';

const windowMeta = { category: 'procurement', name: 'Requisition' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <RequisitionPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
