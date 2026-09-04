import { render, waitFor } from '@testing-library/react';
import { WebMcpMcpTools } from '../WebMcpMcpTools.jsx';

describe('WebMcpMcpTools', () => {
  it('registers exactly the tools returned by Etendo Go and delegates execution', async () => {
    const registerTool = vi.fn();
    document.modelContext = { registerTool };
    const fetcher = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body);
      if (request.method === 'tools/list') {
        return { ok: true, status: 200, json: async () => ({ result: {
          tools: [{ name: 'neo_list', description: 'List records', inputSchema: { type: 'object' } }],
        } }) };
      }
      return { ok: true, status: 200, json: async () => ({ result: { records: [] } }) };
    });

    try {
      render(<WebMcpMcpTools enabled endpoint="/mcp" accessToken="token" fetcher={fetcher} />);
      await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(1));
      const [tool] = registerTool.mock.calls[0];
      expect(tool.name).toBe('neo_list');
      await expect(tool.execute({ spec: 'sales-order' })).resolves.toEqual({ records: [] });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      delete document.modelContext;
    }
  });
});
