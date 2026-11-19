import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbsValue } from "@/hooks/use-breadcrumbs";
import { cn } from "@/lib/utils";

/** The trail under the navbar: where the current page sits in the app. */
export function BreadcrumbsBar() {
  const { t } = useTranslation();
  const crumbs = useBreadcrumbsValue();
  if (!crumbs || crumbs.length === 0) return null;

  return (
    <nav aria-label={t("nav.breadcrumbs")} className="border-b print:hidden">
      <ol className="flex h-10 items-center gap-1.5 px-4 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          // On a phone, only the parent and the current page fit.
          const mobileHidden = index < crumbs.length - 2;
          const label = crumb.label ?? <Skeleton className="h-4 w-24" />;
          return (
            <li
              key={index}
              className={cn(
                "flex items-center gap-1.5",
                last ? "min-w-0" : "shrink-0",
                mobileHidden && "max-sm:hidden",
              )}
            >
              {index > 0 && (
                <ChevronRightIcon
                  aria-hidden
                  className={cn(
                    "text-muted-foreground size-3.5 shrink-0",
                    index === crumbs.length - 2 && "max-sm:hidden",
                  )}
                />
              )}
              {last || !crumb.to ? (
                <span
                  aria-current={last ? "page" : undefined}
                  className="text-foreground truncate font-medium"
                >
                  {label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="text-muted-foreground hover:text-foreground max-w-48 truncate transition-colors"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
