let nextRequestId = 1;

function jsonRpc(method, params) {
  return { jsonrpc: '2.0', id: nextRequestId++, method, ...(params ? { params } : {}) };
}

async function callRpc({ fetcher, endpoint, accessToken, method, params }) {
  const response = await fetcher(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(jsonRpc(method, params)),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`mcp_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  if (body?.error) throw new Error(`mcp_rpc_${body.error.code ?? 'error'}:${body.error.message ?? 'unknown'}`);
  return body?.result ?? {};
}

/** Fetches the same RBAC/scope-filtered catalog exposed by Etendo Go MCP. */
export async function listMcpTools({ fetcher = fetch, endpoint, accessToken }) {
  const result = await callRpc({ fetcher, endpoint, accessToken, method: 'tools/list' });
  return Array.isArray(result.tools) ? result.tools : [];
}

/** Delegates a WebMCP invocation to Etendo Go's existing MCP tools/call route. */
export async function callMcpTool({ fetcher = fetch, endpoint, accessToken, name, arguments: toolArguments = {} }) {
  return callRpc({
    fetcher,
    endpoint,
    accessToken,
    method: 'tools/call',
    params: { name, arguments: toolArguments },
  });
}
