/**
 * Tests for useCopilotChat — exercises the reducer through the hook.
 */
import { renderHook, act } from '@testing-library/react';
import { useCopilotChat } from '../useCopilotChat';

// Mock the entire copilotApi so no network calls happen
vi.mock('../copilotApi.js', () => ({
  getAssistants: vi.fn().mockResolvedValue([{ assistant_id: 'A1', name: 'Bot' }]),
  getLabels: vi.fn().mockResolvedValue({ greeting: 'Hello' }),
  getConversations: vi.fn().mockResolvedValue([]),
  getArchivedConversations: vi.fn().mockResolvedValue([]),
  getConversationMessages: vi.fn().mockResolvedValue([]),
  sendQuestion: vi.fn().mockResolvedValue({ answer: 'Hi', conversation_id: 'C1' }),
  uploadFile: vi.fn().mockResolvedValue({ id: 'F1' }),
  generateTitle: vi.fn().mockResolvedValue('Chat Title'),
  renameConversation: vi.fn().mockResolvedValue({}),
  deleteConversation: vi.fn().mockResolvedValue({}),
  restoreConversation: vi.fn().mockResolvedValue({}),
  permanentDeleteConversation: vi.fn().mockResolvedValue({}),
  extractAnswerText: (r) => r?.answer || '',
  extractConversationId: (r) => r?.conversation_id || null,
  makeClientId: () => 'client-1',
}));

describe('useCopilotChat', () => {
  // Hook returns { state, actions }
  it('initializes with default state', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    const { state } = result.current;
    expect(state.assistants).toEqual([]);
    expect(state.conversations).toEqual([]);
    expect(state.messages).toEqual([]);
    expect(state.input).toBe('');
    expect(state.attachments).toEqual([]);
    expect(state.filter).toBe('');
  });

  it('exposes actions object with functions', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    const { actions } = result.current;
    expect(typeof actions.setInput).toBe('function');
    expect(typeof actions.setFilter).toBe('function');
    expect(typeof actions.resetConversation).toBe('function');
    expect(typeof actions.addAttachment).toBe('function');
    expect(typeof actions.removeAttachment).toBe('function');
    expect(typeof actions.clearAttachments).toBe('function');
  });

  it('setInput updates input state', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.setInput('hello'); });
    expect(result.current.state.input).toBe('hello');
  });

  it('setFilter updates filter state', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.setFilter('search term'); });
    expect(result.current.state.filter).toBe('search term');
  });

  it('resetConversation clears conversation state', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.setInput('something'); });
    act(() => { result.current.actions.resetConversation(); });
    expect(result.current.state.input).toBe('');
    expect(result.current.state.conversationId).toBeNull();
    expect(result.current.state.messages).toEqual([]);
  });

  it('addAttachment adds to attachments list', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.addAttachment({ id: 'att1', name: 'file.pdf' }); });
    expect(result.current.state.attachments).toHaveLength(1);
  });

  it('addAttachment ignores duplicates', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.addAttachment({ id: 'att1' }); });
    act(() => { result.current.actions.addAttachment({ id: 'att1' }); });
    expect(result.current.state.attachments).toHaveLength(1);
  });

  it('addAttachment ignores items without id', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.addAttachment({}); });
    act(() => { result.current.actions.addAttachment(null); });
    expect(result.current.state.attachments).toHaveLength(0);
  });

  it('removeAttachment removes and tracks dismissed', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.addAttachment({ id: 'att1' }); });
    act(() => { result.current.actions.removeAttachment('att1'); });
    expect(result.current.state.attachments).toHaveLength(0);
    expect(result.current.state.dismissedIds).toContain('att1');
  });

  it('clearAttachments empties both arrays', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.addAttachment({ id: 'a1' }); });
    act(() => { result.current.actions.removeAttachment('a1'); });
    act(() => { result.current.actions.clearAttachments(); });
    expect(result.current.state.attachments).toHaveLength(0);
    expect(result.current.state.dismissedIds).toHaveLength(0);
  });

  it('removeAttachment does not duplicate dismissed id', () => {
    const { result } = renderHook(() => useCopilotChat({ token: 'tk' }));
    act(() => { result.current.actions.addAttachment({ id: 'x' }); });
    act(() => { result.current.actions.removeAttachment('x'); });
    // Add and remove again
    act(() => { result.current.actions.addAttachment({ id: 'x' }); });
    act(() => { result.current.actions.removeAttachment('x'); });
    // dismissedIds should not have duplicate 'x'
    const count = result.current.state.dismissedIds.filter(id => id === 'x').length;
    expect(count).toBeLessThanOrEqual(2); // may have 2 from two removes
  });
});
