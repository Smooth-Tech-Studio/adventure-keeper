import { useState, type ReactNode } from "react";

import { BreadcrumbsContext, SetBreadcrumbsContext, type Crumb } from "@/hooks/use-breadcrumbs";

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  return (
    <SetBreadcrumbsContext.Provider value={setCrumbs}>
      <BreadcrumbsContext.Provider value={crumbs}>{children}</BreadcrumbsContext.Provider>
    </SetBreadcrumbsContext.Provider>
  );
}
