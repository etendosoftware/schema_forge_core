import { callMcpTool, listMcpTools } from '../mcpClient.js';

function response(result, ok = true, status = 200) {
  return { ok, status, json: async () => result };
}

describe('Etendo Go MCP WebMCP bridge', () => {
  it('loads the server-authoritative tools/list catalog with bearer auth', async () => {
    const fetcher = vi.fn(async (_url, init) => {
      expect(init.headers.Authorization).toBe('Bearer token');
      expect(JSON.parse(init.body).method).toBe('tools/list');
      return response({ result: { tools: [{ name: 'neo_list', inputSchema: { type: 'object' } }] } });
    });

    await expect(listMcpTools({ fetcher, endpoint: '/mcp', accessToken: 'token' })).resolves.toEqual([
      { name: 'neo_list', inputSchema: { type: 'object' } },
    ]);
  });

  it('delegates a WebMCP invocation to the same tools/call method', async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body);
      expect(request.method).toBe('tools/call');
      expect(request.params).toEqual({ name: 'neo_create', arguments: { spec: 'sales-order' } });
      return response({ result: { content: [{ type: 'text', text: 'created' }] } });
    });

    await expect(callMcpTool({ fetcher, endpoint: '/mcp', accessToken: 'token', name: 'neo_create', arguments: { spec: 'sales-order' } })).resolves.toEqual({
      content: [{ type: 'text', text: 'created' }],
    });
  });

  it('surfaces HTTP and JSON-RPC failures instead of hiding authorization errors', async () => {
    const httpFetcher = vi.fn(async () => response({ error: 'unauthorized' }, false, 401));
    await expect(listMcpTools({ fetcher: httpFetcher, endpoint: '/mcp' })).rejects.toMatchObject({ status: 401 });

    const rpcFetcher = vi.fn(async () => response({ error: { code: -32602, message: 'invalid params' } }));
    await expect(listMcpTools({ fetcher: rpcFetcher, endpoint: '/mcp' })).rejects.toThrow('mcp_rpc_-32602:invalid params');
  });
});
