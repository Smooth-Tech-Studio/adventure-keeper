import { useState, type ReactNode } from "react";

import {
  LicenceNoticeContext,
  SetLicenceNoticeContext,
  type LicenceNoticeId,
} from "@/hooks/use-licence-notice";

export function LicenceNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<LicenceNoticeId | null>(null);
  return (
    <SetLicenceNoticeContext.Provider value={setNotice}>
      <LicenceNoticeContext.Provider value={notice}>{children}</LicenceNoticeContext.Provider>
    </SetLicenceNoticeContext.Provider>
  );
}
