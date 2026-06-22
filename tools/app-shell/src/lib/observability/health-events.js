import { track, group } from '../observability.js';
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

export function trackSessionStarted({ username, clientId } = {}) {
  if (clientId) {
    group('account_id', clientId);
  }
  track('session_started', {
    username: username || undefined,
    account_id: clientId || undefined,
  });
}

export function trackDocumentCreated() {
  const windowName = getWindowName();
  const meta = HEALTH_EVENTS_MAP[windowName];
  if (!meta) return;
  track('document_created', {
    document_type: meta.document_type,
    functional_area: meta.functional_area,
    ...getSessionContext(),
  });
}

export function trackTransactionPosted() {
  const windowName = getWindowName();
  const meta = HEALTH_EVENTS_MAP[windowName];
  if (!meta || !meta.transactional) return;
  track('transaction_posted', {
    document_type: meta.document_type,
    functional_area: meta.functional_area,
    ...getSessionContext(),
  });
}
