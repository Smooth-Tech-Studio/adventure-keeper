import { useTranslation } from "react-i18next";

import { useGmPanelTabs, type GmPanelProps } from "@/components/session/gm-panel/use-gm-panel-tabs";
import { cn } from "@/lib/utils";

/** The GM's side panel on a computer: the tab bar, then the tab, which scrolls. */
export function GmControlPanel(props: GmPanelProps & { className?: string }) {
  const { t } = useTranslation("session", { keyPrefix: "gm.tabs" });
  const { tabs, active, setActive } = useGmPanelTabs(props);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return (
    <aside
      id="gm-panel"
      className={cn(
        "bg-card flex min-h-0 flex-col overflow-hidden rounded-lg border",
        props.className,
      )}
    >
      {/* Sideways only: the line under the tabs is an inner shadow the selected
          tab's border covers, so nothing sticks out to scroll vertically. */}
      <div
        role="tablist"
        aria-label={t("label")}
        className="flex shrink-0 gap-0.5 overflow-x-auto overflow-y-hidden px-2 shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const selected = tab.id === current.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`gm-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="gm-tabpanel"
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-semibold whitespace-nowrap",
                selected
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    tab.id === "combat" ? "bg-red-700 text-white" : "bg-amber-400 text-amber-950",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="gm-tabpanel"
        aria-labelledby={`gm-tab-${current.id}`}
        className="min-h-0 flex-1 overflow-y-auto p-2.5"
      >
        {current.content}
      </div>
    </aside>
  );
}
