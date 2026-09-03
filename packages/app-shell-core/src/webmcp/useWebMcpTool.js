import { useEffect } from 'react';

/** Register an optional WebMCP tool without making it a browser requirement. */
export function useWebMcpTool({ enabled, name, title, description, inputSchema, execute, annotations }) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return undefined;

    const controller = new AbortController();
    try {
      modelContext.registerTool({ name, title, description, inputSchema, annotations, execute }, { signal: controller.signal });
    } catch (error) {
      console.warn(`[webmcp] could not register ${name}`, error);
    }
    return () => controller.abort();
  }, [annotations, description, enabled, execute, inputSchema, name, title]);
}
