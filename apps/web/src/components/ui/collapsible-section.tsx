import { ChevronDownIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onToggle: () => void;
  label: string;
  /** Optional "+" button in the header bar. */
  onAdd?: () => void;
  children: React.ReactNode;
}

/** A titled section that expands/collapses, with an optional header "+" action. */
export function CollapsibleSection({ open, onToggle, label, onAdd, children }: Props) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center">
        <button
          type="button"
          className="hover:bg-accent flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium"
          onClick={onToggle}
          aria-expanded={open}
        >
          {label}
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
        {onAdd && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="mr-1 size-7 shrink-0"
            aria-label={`Ajouter — ${label}`}
            onClick={onAdd}
          >
            <PlusIcon className="size-3.5" />
          </Button>
        )}
      </div>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}
