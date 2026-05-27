import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.jsx';
import ReturnShipmentPage from '@generated/return-to-vendor-shipment/generated/web/return-to-vendor-shipment/ReturnShipmentPage';

export default function ReturnToVendorShipmentWindow({ windowName, recordId, apiBaseUrl, token, ...rest }) {
  const { createContactCtxValue, contactPortal } =
    useCreateContactModal({ apiBaseUrl, token, documentType: 'purchase' });

  if (recordId) {
    return (
      <CreateContactContext.Provider value={createContactCtxValue}>
        <ReturnShipmentPage
          windowName={windowName}
          recordId={recordId}
          apiBaseUrl={apiBaseUrl}
          token={token}
          {...rest}
        />
        {contactPortal}
      </CreateContactContext.Provider>
    );
  }

  return (
    <ReturnShipmentPage
      windowName={windowName}
      apiBaseUrl={apiBaseUrl}
      token={token}
      {...rest}
    />
  );
}
