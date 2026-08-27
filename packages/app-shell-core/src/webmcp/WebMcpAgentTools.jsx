import { useCallback } from 'react';
import { useWebMcpTool } from './useWebMcpTool.js';

const OBJECT_SCHEMA = { type: 'object' };
const NAVIGATE_SCHEMA = {
  type: 'object',
  required: ['route'],
  properties: { route: { type: 'string', description: 'An internal route beginning with /.' } },
};
const READ_ONLY = { readOnlyHint: true };
const READ_ONLY_UNTRUSTED = { readOnlyHint: true, untrustedContentHint: true };

function isInternalRoute(route) {
  return typeof route === 'string' && route.startsWith('/') && !route.startsWith('//');
}

/** Reusable WebMCP facade; consumers provide context, navigation, and chat callbacks. */
export function WebMcpAgentTools({ enabled = false, getContext, navigate, openChat }) {
  const readContext = useCallback(async () => (
    typeof getContext === 'function' ? getContext() : {}
  ), [getContext]);
  useWebMcpTool({
    enabled, name: 'get_current_window_context', title: 'Get current application window context',
    description: 'Returns the route and window context currently visible to the user.',
    inputSchema: OBJECT_SCHEMA, annotations: READ_ONLY_UNTRUSTED, execute: readContext,
  });

  const navigateTo = useCallback(async (input = {}) => {
    if (!isInternalRoute(input.route)) return { ok: false, error: 'route_must_be_internal' };
    if (typeof navigate === 'function') await navigate(input.route);
    return { ok: true, route: input.route };
  }, [navigate]);
  useWebMcpTool({
    enabled, name: 'navigate_application', title: 'Navigate in application',
    description: 'Navigates the host application to an internal route.',
    inputSchema: NAVIGATE_SCHEMA, annotations: READ_ONLY, execute: navigateTo,
  });

  const showChat = useCallback(async () => {
    if (typeof openChat === 'function') await openChat();
    return { ok: true };
  }, [openChat]);
  useWebMcpTool({
    enabled, name: 'open_application_chat', title: 'Open application chat',
    description: 'Opens the host application chat for the user to continue the interaction.',
    inputSchema: OBJECT_SCHEMA, annotations: READ_ONLY, execute: showChat,
  });

  return null;
}
