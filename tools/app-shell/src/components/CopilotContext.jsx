import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useCopilotChat } from './copilot/useCopilotChat.js';
import { useAuth } from '@schema-forge/app-shell-core';

const CopilotContext = createContext(null);

export function CopilotProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const { token } = useAuth();
  const { state, actions } = useCopilotChat({ token });

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    // Closing the panel (not minimize/maximize) clears any auto-attached context.
    actions.clearAttachments();
  }, [actions]);
  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      if (!next) {
        actions.clearAttachments();
      }
      return next;
    });
  }, [actions]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle, state, actions, token }),
    [isOpen, open, close, toggle, state, actions, token],
  );

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
}
