import { useState, type ReactNode } from "react";

import { FullWidthPageContext, SetFullWidthPageContext } from "@/hooks/use-full-width-page";

export function FullWidthPageProvider({ children }: { children: ReactNode }) {
  const [fullWidth, setFullWidth] = useState(false);
  return (
    <SetFullWidthPageContext.Provider value={setFullWidth}>
      <FullWidthPageContext.Provider value={fullWidth}>{children}</FullWidthPageContext.Provider>
    </SetFullWidthPageContext.Provider>
  );
}
