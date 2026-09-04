import { useCallback, useEffect, useState } from 'react';
import { callMcpTool, listMcpTools } from './mcpClient.js';
import { useWebMcpTool } from './useWebMcpTool.js';

function RegisteredMcpTool({ enabled, definition, endpoint, accessToken, fetcher }) {
  const execute = useCallback(async (input = {}) => callMcpTool({
    fetcher, endpoint, accessToken, name: definition.name, arguments: input,
  }), [accessToken, definition.name, endpoint, fetcher]);

  useWebMcpTool({
    enabled,
    name: definition.name,
    title: definition.title || definition.name,
    description: definition.description || `Etendo Go MCP tool ${definition.name}`,
    inputSchema: definition.inputSchema || { type: 'object' },
    annotations: definition.annotations,
    execute,
  });
  return null;
}

/**
 * Mirrors Etendo Go's authenticated MCP catalog in the browser's WebMCP
 * context. The server remains authoritative for tool discovery, RBAC, OAuth
 * scopes, validation, and execution.
 */
export function WebMcpMcpTools({ enabled = false, endpoint, accessToken, fetcher = fetch }) {
  const [definitions, setDefinitions] = useState([]);

  useEffect(() => {
    if (!enabled || !endpoint) {
      setDefinitions([]);
      return undefined;
    }
    let cancelled = false;
    listMcpTools({ fetcher, endpoint, accessToken })
      .then((tools) => { if (!cancelled) setDefinitions(tools); })
      .catch((error) => {
        console.warn('[webmcp] could not load Etendo Go MCP tools', error);
        if (!cancelled) setDefinitions([]);
      });
    return () => { cancelled = true; };
  }, [accessToken, enabled, endpoint, fetcher]);

  return definitions.map((definition) => (
    <RegisteredMcpTool
      key={definition.name}
      enabled={enabled}
      definition={definition}
      endpoint={endpoint}
      accessToken={accessToken}
      fetcher={fetcher} />
  ));
}
