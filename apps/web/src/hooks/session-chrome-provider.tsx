import { useMemo, useState, type ReactNode } from "react";

import { SessionChromeContext, type SessionChrome } from "@/hooks/use-session-chrome";

export function SessionChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<SessionChrome | null>(null);
  const value = useMemo(() => ({ chrome, setChrome }), [chrome]);
  return <SessionChromeContext.Provider value={value}>{children}</SessionChromeContext.Provider>;
}
