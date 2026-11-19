import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { ErrorBoundary } from "@/components/error-boundary";
import { PageLoading } from "@/components/ui/page-loading";

/**
 * No navbar, no footer: the page gets the whole window. For a single block of
 * a live session opened in its own tab (a second screen, the table's TV).
 */
export function BareLayout() {
  const location = useLocation();
  return (
    <div className="bg-background h-svh overflow-hidden">
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
