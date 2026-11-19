import { useTranslation } from "react-i18next";
import type { InvocationEntry } from "@/systems/dnd2024/lib/invocations";
import { sortedByLabel } from "@/lib/sort";

export function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 rounded-lg border px-3 py-2">
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export function ItemGroup<T extends { id: string; name: string; quantity: number; lore?: string }>({
  title,
  items,
  badges,
}: {
  title: string;
  items: T[];
  /** Optional read-only chips per item (damage, AC formula, tool ability…). */
  badges?: (item: T) => string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="text-muted-foreground text-xs font-medium">{title}</p>
      <ul className="grid gap-0.5">
        {sortedByLabel(items, (item) => item.name).map((item) => {
          const chips = badges?.(item) ?? [];
          return (
            <li key={item.id}>
              <span>
                {item.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                {item.lore ? <span className="text-muted-foreground"> — {item.lore}</span> : null}
              </span>
              {chips.length > 0 && (
                <span className="text-muted-foreground ml-1 text-xs">· {chips.join(" · ")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Warlock « Manifestations occultes »: each expands to its reminder. */
export function InvocationGroup({
  entries,
  compact = false,
}: {
  entries: InvocationEntry[];
  /** Smaller type, for the session side panel. */
  compact?: boolean;
}) {
  const { t } = useTranslation("sheet");
  return (
    <div className="grid gap-1">
      <p className="text-muted-foreground text-xs font-medium">{t("invocations")}</p>
      <div className="grid">
        {entries.map(({ invocation, cantripName }, index) => (
          <details
            key={`${invocation.id}:${cantripName ?? index}`}
            className="border-b pb-1 last:border-b-0"
          >
            <summary
              className={`hover:bg-accent cursor-pointer rounded px-1 py-1 font-medium ${compact ? "text-xs" : "text-sm"}`}
            >
              {invocation.name}
              {cantripName && (
                <span className="text-muted-foreground font-normal"> · {cantripName}</span>
              )}
            </summary>
            <p className="text-muted-foreground px-1 pt-0.5 pb-1 text-xs">{invocation.summary}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
