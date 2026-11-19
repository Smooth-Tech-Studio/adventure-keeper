import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** One answer as a card: its name, a line on what it means, ticked when chosen. */
export function OptionCard({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "hover:bg-accent flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors",
        selected && "border-primary bg-accent ring-primary ring-1",
      )}
    >
      <span className="flex items-center justify-between gap-2 font-medium">
        {title}
        {selected && <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />}
      </span>
      {hint && <span className="text-muted-foreground text-xs leading-snug">{hint}</span>}
    </button>
  );
}
