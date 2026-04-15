import { useReducer, useCallback, useMemo } from 'react';
import {
  getAssistants,
  getLabels,
  getConversations,
  getArchivedConversations,
  getConversationMessages,
  sendQuestion,
  uploadFile,
  generateTitle,
  renameConversation as apiRenameConversation,
  deleteConversation as apiDeleteConversation,
  restoreConversation as apiRestoreConversation,
  permanentDeleteConversation as apiPermanentDeleteConversation,
  extractAnswerText,
  extractConversationId,
} from './copilotApi.js';

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

const SET_ASSISTANTS = 'SET_ASSISTANTS';
const SET_LABELS = 'SET_LABELS';
const SET_CONVERSATIONS = 'SET_CONVERSATIONS';
const SET_ARCHIVED = 'SET_ARCHIVED';
const SET_MESSAGES = 'SET_MESSAGES';
const SET_CONVERSATION_ID = 'SET_CONVERSATION_ID';
const SET_SELECTED_ASSISTANT = 'SET_SELECTED_ASSISTANT';
const SET_INPUT = 'SET_INPUT';
const SET_FILES = 'SET_FILES';
const ADD_MESSAGE = 'ADD_MESSAGE';
const UPDATE_CONVERSATION = 'UPDATE_CONVERSATION';
const REMOVE_CONVERSATION = 'REMOVE_CONVERSATION';
const SET_LOADING = 'SET_LOADING';
const SET_ERROR = 'SET_ERROR';
const RESET_CONVERSATION = 'RESET_CONVERSATION';
const SET_FILTER = 'SET_FILTER';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  assistants: [],
  labels: {},
  selectedAssistant: null,
  conversations: [],
  archivedConversations: [],
  messages: [],
  conversationId: null,
  input: '',
  files: [],
  fileIds: [],
  filter: '',
  isLoadingAssistants: false,
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSending: false,
  error: '',
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state, action) {
  switch (action.type) {
    case SET_ASSISTANTS:
      return { ...state, assistants: action.payload };

    case SET_LABELS:
      return { ...state, labels: action.payload };

    case SET_CONVERSATIONS:
      return { ...state, conversations: action.payload };

    case SET_ARCHIVED:
      return { ...state, archivedConversations: action.payload };

    case SET_MESSAGES:
      return { ...state, messages: action.payload };

    case SET_CONVERSATION_ID:
      return { ...state, conversationId: action.payload };

    case SET_SELECTED_ASSISTANT:
      return {
        ...state,
        selectedAssistant: action.payload,
        // Reset per-conversation state when switching assistants.
        conversations: [],
        archivedConversations: [],
        messages: [],
        conversationId: null,
        input: '',
        files: [],
        fileIds: [],
        error: '',
      };

    case SET_INPUT:
      return { ...state, input: action.payload };

    case SET_FILES:
      return { ...state, files: action.files, fileIds: action.fileIds };

    case ADD_MESSAGE:
      return { ...state, messages: [...state.messages, action.payload] };

    case UPDATE_CONVERSATION: {
      const update = (list) =>
        list.map((conv) =>
          conv.conversation_id === action.id
            ? { ...conv, ...action.updates }
            : conv
        );
      return {
        ...state,
        conversations: update(state.conversations),
        archivedConversations: update(state.archivedConversations),
      };
    }

    case REMOVE_CONVERSATION:
      return {
        ...state,
        conversations: state.conversations.filter(
          (c) => c.conversation_id !== action.id
        ),
        archivedConversations: state.archivedConversations.filter(
          (c) => c.conversation_id !== action.id
        ),
      };

    case SET_LOADING:
      return { ...state, [action.key]: action.value };

    case SET_ERROR:
      return { ...state, error: action.payload };

    case RESET_CONVERSATION:
      return {
        ...state,
        messages: [],
        conversationId: null,
        input: '',
        files: [],
        fileIds: [],
        error: '',
      };

    case SET_FILTER:
      return { ...state, filter: action.payload };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function makeMessageId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useCopilotChat — centralized state management for the full copilot chat UI.
 *
 * @param {{ token: string|null }} options
 * @returns {{ state: object, actions: object }}
 */
export function useCopilotChat({ token }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ------------------------------------------------------------------
  // Bootstrap
  // ------------------------------------------------------------------

  /**
   * Fetch assistants and labels in parallel and populate the store.
   */
  const loadBootstrap = useCallback(async () => {
    if (!token) return;

    dispatch({ type: SET_LOADING, key: 'isLoadingAssistants', value: true });
    dispatch({ type: SET_ERROR, payload: '' });

    try {
      const [assistants, labels] = await Promise.all([
        getAssistants(token),
        getLabels(token),
      ]);
      dispatch({ type: SET_ASSISTANTS, payload: assistants });
      dispatch({ type: SET_LABELS, payload: labels });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to load assistants' });
    } finally {
      dispatch({ type: SET_LOADING, key: 'isLoadingAssistants', value: false });
    }
  }, [token]);

  // ------------------------------------------------------------------
  // Conversations
  // ------------------------------------------------------------------

  /**
   * Load active conversations for the currently selected assistant.
   */
  const loadConversations = useCallback(async () => {
    if (!token || !state.selectedAssistant) return;

    dispatch({ type: SET_LOADING, key: 'isLoadingConversations', value: true });
    try {
      const convs = await getConversations(token, state.selectedAssistant.app_id);
      dispatch({ type: SET_CONVERSATIONS, payload: convs });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to load conversations' });
    } finally {
      dispatch({ type: SET_LOADING, key: 'isLoadingConversations', value: false });
    }
  }, [token, state.selectedAssistant]);

  /**
   * Load archived conversations for the currently selected assistant.
   */
  const loadArchivedConversations = useCallback(async () => {
    if (!token || !state.selectedAssistant) return;

    dispatch({ type: SET_LOADING, key: 'isLoadingConversations', value: true });
    try {
      const convs = await getArchivedConversations(token, state.selectedAssistant.app_id);
      dispatch({ type: SET_ARCHIVED, payload: convs });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to load archived conversations' });
    } finally {
      dispatch({ type: SET_LOADING, key: 'isLoadingConversations', value: false });
    }
  }, [token, state.selectedAssistant]);

  // ------------------------------------------------------------------
  // Assistant selection
  // ------------------------------------------------------------------

  /**
   * Select an assistant, reset per-conversation state, and load its conversations.
   *
   * @param {object} assistant
   */
  const selectAssistant = useCallback(async (assistant) => {
    dispatch({ type: SET_SELECTED_ASSISTANT, payload: assistant });
    if (!token || !assistant) return;

    dispatch({ type: SET_LOADING, key: 'isLoadingConversations', value: true });
    try {
      const convs = await getConversations(token, assistant.app_id);
      dispatch({ type: SET_CONVERSATIONS, payload: convs });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to load conversations' });
    } finally {
      dispatch({ type: SET_LOADING, key: 'isLoadingConversations', value: false });
    }
  }, [token]);

  // ------------------------------------------------------------------
  // Message selection & navigation
  // ------------------------------------------------------------------

  /**
   * Load messages for the given conversation and make it the active one.
   *
   * @param {object} conv - Conversation object (must have conversation_id)
   */
  const selectConversation = useCallback(async (conv) => {
    if (!token || !conv?.conversation_id) return;

    dispatch({ type: SET_CONVERSATION_ID, payload: conv.conversation_id });
    dispatch({ type: SET_LOADING, key: 'isLoadingMessages', value: true });
    dispatch({ type: SET_ERROR, payload: '' });

    try {
      const messages = await getConversationMessages(token, conv.conversation_id);
      dispatch({ type: SET_MESSAGES, payload: messages });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to load messages' });
    } finally {
      dispatch({ type: SET_LOADING, key: 'isLoadingMessages', value: false });
    }
  }, [token]);

  /**
   * Clear the active conversation so the user can start fresh.
   * The selected assistant is preserved.
   */
  const startNewConversation = useCallback(() => {
    dispatch({ type: RESET_CONVERSATION });
  }, []);

  // ------------------------------------------------------------------
  // Messaging
  // ------------------------------------------------------------------

  /**
   * Send a message to the selected assistant and append both the user bubble
   * and the copilot response (or an error bubble) to the messages list.
   *
   * @param {string} question - Text to send
   */
  const sendMessage = useCallback(async (question) => {
    if (!question?.trim() || !state.selectedAssistant || !token || state.isSending) return;

    dispatch({ type: SET_ERROR, payload: '' });
    dispatch({ type: SET_LOADING, key: 'isSending', value: true });

    const userMessage = {
      id: makeMessageId(),
      role: 'user',
      text: question.trim(),
      timestamp: formatTimestamp(),
      files: state.files,
    };

    dispatch({ type: ADD_MESSAGE, payload: userMessage });
    dispatch({ type: SET_INPUT, payload: '' });

    try {
      const response = await sendQuestion(token, {
        app_id: state.selectedAssistant.app_id,
        question: question.trim(),
        conversation_id: state.conversationId || undefined,
        file: state.fileIds.length > 0 ? state.fileIds : undefined,
      });

      const answerText = extractAnswerText(response) || 'No response received.';
      const newConversationId = extractConversationId(response);
      const isFirstReply = !state.conversationId && newConversationId;

      if (newConversationId) {
        dispatch({ type: SET_CONVERSATION_ID, payload: newConversationId });
      }

      dispatch({
        type: ADD_MESSAGE,
        payload: {
          id: makeMessageId(),
          role: 'copilot',
          text: answerText,
          timestamp: formatTimestamp(),
        },
      });

      // Clear pending file attachments after a successful send.
      dispatch({ type: SET_FILES, files: [], fileIds: [] });

      // Auto-generate a title after the first reply in a new conversation.
      if (isFirstReply) {
        generateTitle(token, newConversationId)
          .then((res) => {
            const title = res?.title || res?.generated_title;
            if (title) {
              dispatch({ type: UPDATE_CONVERSATION, id: newConversationId, updates: { title } });
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      dispatch({
        type: ADD_MESSAGE,
        payload: {
          id: makeMessageId(),
          role: 'error',
          text: err.message || 'Failed to send message.',
          timestamp: formatTimestamp(),
        },
      });
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to send message.' });
    } finally {
      dispatch({ type: SET_LOADING, key: 'isSending', value: false });
    }
  }, [state.selectedAssistant, state.conversationId, state.fileIds, state.files, state.isSending, token]);

  // ------------------------------------------------------------------
  // Conversation management
  // ------------------------------------------------------------------

  /**
   * Soft-delete a conversation (moves it to the archived list).
   *
   * @param {string} id - conversation_id
   */
  const deleteConversationAction = useCallback(async (id) => {
    if (!token || !id) return;
    try {
      await apiDeleteConversation(token, id);
      // Move from active to archived list.
      const archived = state.conversations.find((c) => c.conversation_id === id);
      dispatch({ type: REMOVE_CONVERSATION, id });
      if (archived) {
        dispatch({ type: SET_ARCHIVED, payload: [...state.archivedConversations, archived] });
      }
      // If the deleted conversation was the active one, reset the view.
      if (state.conversationId === id) {
        dispatch({ type: RESET_CONVERSATION });
      }
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to delete conversation.' });
    }
  }, [token, state.conversations, state.archivedConversations, state.conversationId]);

  /**
   * Restore an archived conversation back to the active list.
   *
   * @param {string} id - conversation_id
   */
  const restoreConversationAction = useCallback(async (id) => {
    if (!token || !id) return;
    try {
      await apiRestoreConversation(token, id);
      const conv = state.archivedConversations.find((c) => c.conversation_id === id);
      dispatch({
        type: SET_ARCHIVED,
        payload: state.archivedConversations.filter((c) => c.conversation_id !== id),
      });
      if (conv) {
        dispatch({ type: SET_CONVERSATIONS, payload: [...state.conversations, conv] });
      }
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to restore conversation.' });
    }
  }, [token, state.archivedConversations, state.conversations]);

  /**
   * Permanently delete an archived conversation (irreversible).
   *
   * @param {string} id - conversation_id
   */
  const permanentDelete = useCallback(async (id) => {
    if (!token || !id) return;
    try {
      await apiPermanentDeleteConversation(token, id);
      dispatch({ type: REMOVE_CONVERSATION, id });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to permanently delete conversation.' });
    }
  }, [token]);

  /**
   * Rename a conversation and update it in the local list.
   *
   * @param {string} id - conversation_id
   * @param {string} title - New title
   */
  const renameConversationAction = useCallback(async (id, title) => {
    if (!token || !id || !title?.trim()) return;
    try {
      await apiRenameConversation(token, id, title.trim());
      dispatch({ type: UPDATE_CONVERSATION, id, updates: { title: title.trim() } });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to rename conversation.' });
    }
  }, [token]);

  /**
   * Auto-generate a title for a conversation and update it in the local list.
   *
   * @param {string} id - conversation_id
   */
  const generateTitleAction = useCallback(async (id) => {
    if (!token || !id) return;
    try {
      const response = await generateTitle(token, id);
      const title = response?.title || response?.generated_title;
      if (title) {
        dispatch({ type: UPDATE_CONVERSATION, id, updates: { title } });
      }
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to generate title.' });
    }
  }, [token]);

  // ------------------------------------------------------------------
  // File management
  // ------------------------------------------------------------------

  /**
   * Upload a file and track it in the pending attachments list.
   *
   * @param {File} file
   */
  const uploadFileAction = useCallback(async (file) => {
    if (!token || !file) return;
    try {
      const data = await uploadFile(token, file);
      const uploadId =
        data?.fileId ||
        data?.id ||
        Object.values(data || {}).find((v) => typeof v === 'string');
      dispatch({
        type: SET_FILES,
        files: [...state.files, file],
        fileIds: uploadId ? [...state.fileIds, uploadId] : state.fileIds,
      });
      dispatch({ type: SET_ERROR, payload: '' });
    } catch (err) {
      dispatch({ type: SET_ERROR, payload: err.message || 'Failed to upload file.' });
    }
  }, [token, state.files, state.fileIds]);

  /**
   * Remove a pending file attachment by index.
   *
   * @param {number} index
   */
  const removeFile = useCallback((index) => {
    dispatch({
      type: SET_FILES,
      files: state.files.filter((_, i) => i !== index),
      fileIds: state.fileIds.filter((_, i) => i !== index),
    });
  }, [state.files, state.fileIds]);

  // ------------------------------------------------------------------
  // Simple setters
  // ------------------------------------------------------------------

  /** @param {string} value */
  const setInput = useCallback((value) => {
    dispatch({ type: SET_INPUT, payload: value });
  }, []);

  /** @param {string} value */
  const setFilter = useCallback((value) => {
    dispatch({ type: SET_FILTER, payload: value });
  }, []);

  /** Reset messages, input, error, and pending files. */
  const resetConversation = useCallback(() => {
    dispatch({ type: RESET_CONVERSATION });
  }, []);

  // ------------------------------------------------------------------
  // Stable actions object
  // ------------------------------------------------------------------

  const actions = useMemo(() => ({
    loadBootstrap,
    loadConversations,
    loadArchivedConversations,
    selectAssistant,
    selectConversation,
    startNewConversation,
    sendMessage,
    deleteConversation: deleteConversationAction,
    restoreConversation: restoreConversationAction,
    permanentDelete,
    renameConversation: renameConversationAction,
    generateTitle: generateTitleAction,
    uploadFile: uploadFileAction,
    removeFile,
    setInput,
    setFilter,
    resetConversation,
  }), [
    loadBootstrap,
    loadConversations,
    loadArchivedConversations,
    selectAssistant,
    selectConversation,
    startNewConversation,
    sendMessage,
    deleteConversationAction,
    restoreConversationAction,
    permanentDelete,
    renameConversationAction,
    generateTitleAction,
    uploadFileAction,
    removeFile,
    setInput,
    setFilter,
    resetConversation,
  ]);

  return { state, actions };
}
