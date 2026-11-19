import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import type { ImpactLine, OriginImpact } from "@/systems/dnd2024/creation-wizard/impact";
import { cn } from "@/lib/utils";

function Column({
  title,
  mark,
  tone,
  lines,
  empty,
  children,
}: {
  title: string;
  mark: string;
  tone: "lost" | "gained" | "kept";
  lines: ImpactLine[];
  empty: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4",
        tone === "lost" && "border-destructive/40",
        tone === "gained" && "border-emerald-600/40",
      )}
    >
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span
          className={cn(
            "grid size-5 place-items-center rounded-md text-xs font-medium",
            tone === "lost" && "bg-destructive/15 text-destructive",
            tone === "gained" && "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
            tone === "kept" && "bg-muted text-muted-foreground",
          )}
        >
          {mark}
        </span>
        {title}
        {tone !== "kept" && (
          <span className="text-muted-foreground font-normal tabular-nums">{lines.length}</span>
        )}
      </h3>
      {lines.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {lines.map((line) => (
            <li key={`${line.detail}:${line.label}`}>
              {line.label}
              {line.detail && (
                <span className="text-muted-foreground block text-xs">{line.detail}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{empty}</p>
      )}
      {children}
    </section>
  );
}

/**
 * Before anything changes on the sheet: what leaves it, what comes with the new
 * choice, what is left alone — and a box to tick before going on.
 */
export function ImpactStep({
  impact,
  upcoming,
  acknowledged,
  onAcknowledge,
}: {
  impact: OriginImpact;
  /** The questions still to come for this step, by their rail label. */
  upcoming: string[];
  acknowledged?: boolean;
  /** Absent: the summary only, without the confirmation box. */
  onAcknowledge?: (value: boolean) => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "impactStep" });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 @3xl:grid-cols-3">
        <Column title={t("lost")} mark="−" tone="lost" lines={impact.lost} empty={t("lostEmpty")} />
        <Column
          title={t("gained")}
          mark="+"
          tone="gained"
          lines={impact.gained}
          empty={t("gainedEmpty")}
        >
          {upcoming.length > 0 && (
            <div className="mt-1 flex flex-col gap-1.5 border-t pt-2">
              <span className="type-label">{t("upcoming")}</span>
              <div className="flex flex-wrap gap-1">
                {upcoming.map((label) => (
                  <span key={label} className="bg-muted rounded-full border px-2 py-0.5 text-xs">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Column>
        <Column title={t("kept")} mark="=" tone="kept" lines={impact.kept} empty="" />
      </div>

      {impact.numbers.length > 0 && (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-3 py-2 font-medium" />
                <th className="px-3 py-2 font-medium">{t("before")}</th>
                <th className="px-3 py-2 font-medium">{t("after")}</th>
              </tr>
            </thead>
            <tbody>
              {impact.numbers.map(([label, from, to]) => (
                <tr key={label} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2 tabular-nums">{from}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onAcknowledge && (
        <label className="bg-card flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={Boolean(acknowledged)}
            onCheckedChange={(value) => onAcknowledge(value === true)}
          />
          <span>
            {impact.lost.length > 0 ? t("ack", { count: impact.lost.length }) : t("ackNone")}
          </span>
        </label>
      )}
    </div>
  );
}
