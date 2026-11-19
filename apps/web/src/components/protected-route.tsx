import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/hooks/use-auth";

/**
 * Gate for pages that require an authenticated user. Redirects to `/login`,
 * remembering where the user was headed so login can send them back.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
