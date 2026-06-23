import { track, group, identify, flush } from '../observability.js';
import { extractWindowName } from './payload.js';
import { HEALTH_EVENTS_MAP } from './health-events.map.js';

function getWindowName() {
  try {
    return extractWindowName(window.location.pathname);
  } catch {
    return undefined;
  }
}

function getSessionContext() {
  try {
    return {
      account_id: localStorage.getItem('sf_auth_client_id') || undefined,
      username: localStorage.getItem('sf_auth_user') || undefined,
    };
  } catch {
    return {};
  }
}

export async function trackSessionStarted({ username, clientId } = {}) {
  if (username) {
    await identify(username);
  }
  if (clientId) {
    void group('account_id', clientId);
  }
  await track('session_started', {
    username: username || undefined,
    account_id: clientId || undefined,
  });
  await flush();
}

export function trackDocumentCreated() {
  const windowName = getWindowName();
  const meta = HEALTH_EVENTS_MAP[windowName];
  if (!meta) return;
  void track('document_created', {
    document_type: meta.document_type,
    functional_area: meta.functional_area,
    ...getSessionContext(),
  });
}

export function trackTransactionPosted() {
  const windowName = getWindowName();
  const meta = HEALTH_EVENTS_MAP[windowName];
  if (!meta || !meta.transactional) return;
  void track('transaction_posted', {
    document_type: meta.document_type,
    functional_area: meta.functional_area,
    ...getSessionContext(),
  });
}
