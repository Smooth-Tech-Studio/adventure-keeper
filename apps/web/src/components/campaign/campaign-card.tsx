import type { ComponentType, ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A card of the campaign page, compact: an icon and a title, an action on the
 * right, then its content. Without a title (a phone's tab already names it),
 * only the content.
 */
export function CampaignCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
  ...props
}: {
  title?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
} & Omit<React.ComponentProps<"div">, "title">) {
  return (
    <Card className={cn("gap-3 py-4", className)} {...props}>
      {title && (
        <CardHeader className="flex min-h-8 flex-row items-center gap-2 px-4">
          <CardTitle className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            {Icon && <Icon className="text-muted-foreground size-4 shrink-0" />}
            {title}
          </CardTitle>
          {action}
        </CardHeader>
      )}
      <CardContent className={cn("px-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
