import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { AppFooter } from "@/components/app-footer";
import { BreadcrumbsBar } from "@/components/breadcrumbs-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { Navbar } from "@/components/navbar";
import { PageLoading } from "@/components/ui/page-loading";
import { useFullWidthPageValue } from "@/hooks/use-full-width-page";
import { useSessionChrome } from "@/hooks/use-session-chrome";
import { cn } from "@/lib/utils";

export function RootLayout() {
  const location = useLocation();
  // A live session owns the full viewport on desktop (fixed height, no page
  // scroll — its blocks scroll internally instead) and never shows the footer,
  // on any screen size.
  const { chrome } = useSessionChrome();
  const inSession = chrome !== null;
  // A full-width page (the guided creation) sits right under the navbar.
  const fullWidth = useFullWidthPageValue();

  return (
    <div
      className={cn(
        "bg-background flex min-h-svh flex-col",
        inSession && "lg:h-svh lg:overflow-hidden",
      )}
    >
      <Navbar />
      {/* The session view has its own control in the navbar and needs every pixel. */}
      {!inSession && !fullWidth && <BreadcrumbsBar />}
      <main className={cn("flex-1", inSession && "lg:min-h-0 lg:overflow-hidden")}>
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      {/* The guided creation fills the screen down to its own action bar. */}
      {!inSession && !fullWidth && <AppFooter />}
    </div>
  );
}
