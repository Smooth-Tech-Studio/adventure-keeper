import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const storeKey = (key: string) => `ak.story.${key}`;

function readOpen(key: string | undefined): boolean {
  if (!key) return true;
  try {
    return window.localStorage.getItem(storeKey(key)) !== "0";
  } catch {
    return true;
  }
}

function writeOpen(key: string | undefined, open: boolean) {
  if (!key) return;
  try {
    window.localStorage.setItem(storeKey(key), open ? "1" : "0");
  } catch {
    /* storage unavailable — the in-memory state still works */
  }
}

/**
 * One box of a character's story — a chapter, or an adventure of the journal.
 * A tap on its title hides or shows its text; what sits on the right (badges,
 * buttons) stays outside the toggle. Remembered per viewer with `storageKey`.
 */
export function StoryBox({
  title,
  heading: Heading = "h3",
  large = false,
  subtitle,
  aside,
  storageKey,
  className,
  children,
}: {
  title: ReactNode;
  /** The title's level; the toggle sits inside it, as in an accordion. */
  heading?: "h3" | "h4";
  /** Over its entries' own titles (an adventure of the journal): a size up. */
  large?: boolean;
  subtitle?: ReactNode;
  aside?: ReactNode;
  storageKey?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(storageKey));
  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        writeOpen(storageKey, next);
      }}
      asChild
    >
      <Card className={cn("gap-0 py-0", className)}>
        <div className="flex flex-wrap items-start justify-end gap-x-2 gap-y-1 py-3 pr-3 pl-3 sm:pr-4 sm:pl-4">
          <Heading
            className={cn(
              "min-w-0 flex-1 basis-56 font-semibold tracking-tight",
              large ? "text-2xl" : "text-xl",
            )}
          >
            <CollapsibleTrigger className="hover:bg-accent/50 flex w-full items-start gap-2 rounded-md px-2 py-1 text-left">
              <ChevronDownIcon
                className={cn(
                  "text-muted-foreground size-4 shrink-0 transition-transform",
                  large ? "mt-2.5" : "mt-2",
                  !open && "-rotate-90",
                )}
              />
              <span className="min-w-0 flex-1">
                {title}
                {subtitle && (
                  <span className="text-muted-foreground block text-xs font-normal tracking-normal">
                    {subtitle}
                  </span>
                )}
              </span>
            </CollapsibleTrigger>
          </Heading>
          {aside && <div className="flex shrink-0 items-center gap-1 pt-0.5">{aside}</div>}
        </div>
        <CollapsibleContent className="flex flex-col gap-4 px-6 pt-1 pb-5 sm:pr-8 sm:pl-12">
          {children}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
