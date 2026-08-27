import { render } from '@testing-library/react';
import { WebMcpAgentTools } from '../WebMcpAgentTools.jsx';

const registerTool = vi.fn();
const abort = vi.fn();
const navigate = vi.fn();
const openChat = vi.fn();

describe('WebMcpAgentTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.modelContext = { registerTool };
    registerTool.mockImplementation((_tool, options) => options.signal.addEventListener('abort', abort));
  });

  afterEach(() => delete document.modelContext);

  it('registers context, navigation, and chat tools when enabled', () => {
    const { unmount } = render(<WebMcpAgentTools enabled getContext={() => ({ pathname: '/orders' })} navigate={navigate} openChat={openChat} />);
    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'get_current_window_context', 'navigate_application', 'open_application_chat',
    ]);
    unmount();
    expect(abort).toHaveBeenCalledTimes(3);
  });

  it('does not register tools when disabled', () => {
    render(<WebMcpAgentTools getContext={() => ({})} navigate={navigate} openChat={openChat} />);
    expect(registerTool).not.toHaveBeenCalled();
  });

  it('rejects external routes without invoking the consumer router', async () => {
    render(<WebMcpAgentTools enabled getContext={() => ({})} navigate={navigate} openChat={openChat} />);
    const tool = registerTool.mock.calls.find(([item]) => item.name === 'navigate_application')[0];
    await expect(tool.execute({ route: 'https://example.com' })).resolves.toEqual({ ok: false, error: 'route_must_be_internal' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the consumer chat through the registered tool', async () => {
    render(<WebMcpAgentTools enabled getContext={() => ({})} navigate={navigate} openChat={openChat} />);
    const tool = registerTool.mock.calls.find(([item]) => item.name === 'open_application_chat')[0];
    await expect(tool.execute({})).resolves.toEqual({ ok: true });
    expect(openChat).toHaveBeenCalledTimes(1);
  });
});
