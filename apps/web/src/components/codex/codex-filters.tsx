import { LayersIcon, SearchIcon, type LucideIcon } from "lucide-react";
import { CODEX_KINDS, type CodexKind } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CODEX_KIND_ICONS } from "@/components/codex/codex-kinds";
import { CODEX_VISIBILITIES, type CodexVisibility } from "@/lib/codex-filter";
import { cn } from "@/lib/utils";

/**
 * The codex's filters: the search and, for the GM, revealed / hidden on a
 * first line; then one chip per kind, with its icon and count. A kind with no
 * entry is left out, unless it is the one selected.
 */
export function CodexFilters({
  search,
  onSearchChange,
  kind,
  onKindChange,
  visibility,
  onVisibilityChange,
  counts,
  isGm,
}: {
  search: string;
  onSearchChange: (search: string) => void;
  kind: CodexKind | "all";
  onKindChange: (kind: CodexKind | "all") => void;
  visibility: CodexVisibility;
  onVisibilityChange: (visibility: CodexVisibility) => void;
  counts: Record<CodexKind | "all", number>;
  isGm: boolean;
}) {
  const { t } = useTranslation("codex");
  const kinds = CODEX_KINDS.filter((k) => counts[k] > 0 || k === kind);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            placeholder={t("search")}
            aria-label={t("search")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {isGm && (
          <Select
            value={visibility}
            onValueChange={(value) => onVisibilityChange(value as CodexVisibility)}
          >
            <SelectTrigger className="w-40" aria-label={t("filters.visibility")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {CODEX_VISIBILITIES.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`filters.shown.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div role="group" aria-label={t("filters.kinds")} className="flex flex-wrap gap-1.5">
        <KindChip
          label={t("all")}
          icon={LayersIcon}
          count={counts.all}
          selected={kind === "all"}
          onClick={() => onKindChange("all")}
        />
        {kinds.map((k) => (
          <KindChip
            key={k}
            label={t(`kindsPlural.${k}`)}
            icon={CODEX_KIND_ICONS[k]}
            count={counts[k]}
            selected={kind === k}
            // A second click on the selected chip goes back to everything.
            onClick={() => onKindChange(kind === k ? "all" : k)}
          />
        ))}
      </div>
    </div>
  );
}

function KindChip({
  label,
  icon: Icon,
  count,
  selected,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-[3px]",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-muted text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
      <span
        className={cn(
          "text-xs tabular-nums",
          selected ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
