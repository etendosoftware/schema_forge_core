import { createContext, useContext, useState, useCallback } from 'react';
import { useCopilotChat } from './copilot/useCopilotChat.js';
import { useAuth } from '@/auth/AuthContext.jsx';

const CopilotContext = createContext(null);

export function CopilotProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const { token } = useAuth();
  const { state, actions } = useCopilotChat({ token });

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <CopilotContext.Provider value={{ isOpen, open, close, toggle, state, actions, token }}>
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
}
