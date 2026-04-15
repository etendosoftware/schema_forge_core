import { useRef, useCallback, useEffect } from 'react';

/**
 * useSSE — hook for consuming Server-Sent Events from the copilot service.
 *
 * @returns {{ startStream: Function, closeStream: Function, isStreaming: React.MutableRefObject<boolean> }}
 */
export function useSSE() {
  /** @type {React.MutableRefObject<EventSource|null>} */
  const sourceRef = useRef(null);
  /** @type {React.MutableRefObject<boolean>} */
  const isStreaming = useRef(false);

  // Auto-cleanup when the component that owns the hook unmounts.
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
        isStreaming.current = false;
      }
    };
  }, []);

  /**
   * Close the active EventSource connection, if any.
   */
  const closeStream = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    isStreaming.current = false;
  }, []);

  /**
   * Open an EventSource connection and pipe events to the provided callbacks.
   *
   * @param {string} url - The full SSE URL (use buildSSEUrl from copilotApi.js)
   * @param {{ onMessage: Function, onError: Function, onComplete: Function }} callbacks
   */
  const startStream = useCallback((url, { onMessage, onError, onComplete } = {}) => {
    // Close any existing stream before opening a new one.
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const source = new EventSource(url);
    sourceRef.current = source;
    isStreaming.current = true;

    source.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage?.(parsed);
      } catch {
        // Non-JSON chunk — pass the raw string wrapped in an object.
        onMessage?.({ raw: event.data });
      }
    });

    // The server signals the end of the stream with a custom "end" event.
    source.addEventListener('end', () => {
      source.close();
      sourceRef.current = null;
      isStreaming.current = false;
      onComplete?.();
    });

    source.addEventListener('error', (event) => {
      // EventSource readyState 2 = CLOSED; treat it as a normal completion
      // if the source was explicitly closed from the server side.
      if (source.readyState === EventSource.CLOSED) {
        sourceRef.current = null;
        isStreaming.current = false;
        onComplete?.();
        return;
      }

      const error = new Error('SSE connection error');
      onError?.(error);
      source.close();
      sourceRef.current = null;
      isStreaming.current = false;
    });
  }, []);

  return { startStream, closeStream, isStreaming };
}
