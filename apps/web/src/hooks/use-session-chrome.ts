import { createContext, useContext } from "react";

/**
 * While a live session is open, the page publishes its controls here so the
 * global navbar can host the "En direct" control instead of the session view
 * rendering a second bar of its own.
 */
export interface SessionChrome {
  connectedCount: number;
  /** The GM can end the session; players only get "Quitter". */
  canControl: boolean;
  onEnd: () => void;
  onLeave: () => void;
  leaveLabel: string;
}

export interface SessionChromeContextValue {
  chrome: SessionChrome | null;
  setChrome: (chrome: SessionChrome | null) => void;
}

export const SessionChromeContext = createContext<SessionChromeContextValue | undefined>(undefined);

export function useSessionChrome(): SessionChromeContextValue {
  const context = useContext(SessionChromeContext);
  if (!context) throw new Error("useSessionChrome must be used within a SessionChromeProvider");
  return context;
}
