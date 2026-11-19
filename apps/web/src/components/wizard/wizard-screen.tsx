import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * The right-hand column of a guided flow: where we are, the question, the
 * answer area with its « Pourquoi ce choix ? » column, and the sticky footer
 * with « Précédent » / « Suivant ». The creation and the level-up both render
 * their sub-steps through it, so the two look and move the same way.
 */
export function WizardScreen({
  eyebrow,
  segments,
  current,
  title,
  lead,
  headerExtra,
  wide = false,
  fill = false,
  aside,
  why,
  whyTitle: whyTitleProp,
  issues = [],
  footer,
  children,
}: {
  /** « Étape 2 · Espèce — 1 sur 4 ». */
  eyebrow: string;
  /** One bar per sub-step; `done` turns it green. */
  segments: { key: string; done: boolean }[];
  current: number;
  title: string;
  lead?: string;
  headerExtra?: ReactNode;
  /** Uses the full width — no help column. */
  wide?: boolean;
  /** The body grows to fill the screen (the carousel). */
  fill?: boolean;
  /** Above the help, in the side column. */
  aside?: ReactNode;
  why?: ReactNode;
  /** The question `why` answers; generic when the screen has none. */
  whyTitle?: string;
  /** Problems that belong to no single field, shown above the footer. */
  issues?: string[];
  footer: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation("wizard");
  const whyTitle = whyTitleProp ?? t("screen.why");
  return (
    // At least the screen height under the navbar, so the carousel can fill it.
    <div className="flex min-w-0 flex-col text-sm lg:min-h-[calc(100svh-3.5rem)]">
      <WizardProgress eyebrow={eyebrow} segments={segments} current={current} />

      <div className={cn("flex flex-1 flex-col px-4 pb-8 sm:px-6", fill && "pb-4")}>
        {/* A short question sits in the middle of a tall screen rather than
            under the progress bar with an empty half below; a long one just
            starts at the top and scrolls. */}
        <div className={cn("flex flex-col gap-4 pt-3", fill ? "flex-1" : "lg:my-auto lg:py-6")}>
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="type-title">{title}</h1>
              {headerExtra}
            </div>
            {lead && <p className="text-muted-foreground text-sm">{lead}</p>}
          </div>

          {wide ? (
            <div className={cn("@container", fill && "flex flex-1 flex-col")}>{children}</div>
          ) : (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="@container min-w-0">{children}</div>
              <aside className="flex flex-col gap-3 xl:sticky xl:top-4">
                {aside}
                {why && (
                  <div className="bg-muted flex flex-col gap-1.5 rounded-xl p-4 text-sm leading-relaxed">
                    <span className="font-medium">{whyTitle}</span>
                    <span className="text-muted-foreground">{why}</span>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>

      <div className="bg-background/95 sticky bottom-0 z-20 border-t backdrop-blur">
        {issues.length > 0 && (
          <ul className="text-destructive grid gap-0.5 px-4 pt-2 text-sm sm:px-6" role="alert">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 px-4 py-3 sm:px-6">{footer}</div>
      </div>
    </div>
  );
}

/** Where a guided flow stands: « Étape 2 · Espèce — 1 sur 4 » and one bar per sub-step. */
export function WizardProgress({
  eyebrow,
  segments,
  current,
}: {
  eyebrow: string;
  /** `done` turns a bar green. */
  segments: { key: string; done: boolean }[];
  current: number;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 px-4 pt-5 sm:px-6">
      <span className="type-label">{eyebrow}</span>
      <div className="flex min-w-40 flex-1 gap-1" aria-hidden>
        {segments.map((segment, index) => (
          <span
            key={segment.key}
            className={cn(
              "bg-border h-1 flex-1 rounded-full",
              segment.done && "bg-emerald-600",
              index === current && "bg-primary",
            )}
          />
        ))}
      </div>
    </header>
  );
}
