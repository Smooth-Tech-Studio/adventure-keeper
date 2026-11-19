import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { CastIcon, ExternalLinkIcon, MaximizeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { sessionPath, type SessionPane } from "@/lib/session-panes";
import { cn } from "@/lib/utils";

/** The whole window, given to a single block of the session view. */
export function SessionPaneFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id="session-view"
      className={cn("grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)] p-3", className)}
    >
      {children}
    </div>
  );
}

/** Opens a pane of the current session in a new tab (`null` outside a session route). */
function useOpenSessionPane(): ((pane: SessionPane) => void) | null {
  const { id, adventureId, sessionId } = useParams<{
    id: string;
    adventureId: string;
    sessionId: string;
  }>();
  if (!id || !adventureId || !sessionId) return null;
  const base = sessionPath(id, adventureId, sessionId);
  return (pane) => window.open(`${base}/${pane}`, "_blank");
}

/** "Ouvrir dans un onglet" entries for a session menu, one per pane. */
export function SessionPaneMenuItems({ panes }: { panes: { pane: SessionPane; label: string }[] }) {
  const { t } = useTranslation("session", { keyPrefix: "pane" });
  const open = useOpenSessionPane();
  if (!open) return null;
  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-2 font-normal">
        <ExternalLinkIcon className="size-3.5" /> {t("openInTab")}
      </DropdownMenuLabel>
      {panes.map(({ pane, label }) => (
        <DropdownMenuItem key={pane} onSelect={() => open(pane)}>
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** GM: open the players' view of the map in a tab, to put on the table's TV. */
export function ProjectMapMenuItem() {
  const { t } = useTranslation("session", { keyPrefix: "pane" });
  const open = useOpenSessionPane();
  if (!open) return null;
  return (
    <DropdownMenuItem onSelect={() => open("carte")}>
      <CastIcon /> {t("project")}
    </DropdownMenuItem>
  );
}

/**
 * Puts the whole tab in full screen — for a projected map. Has to be clicked
 * in that very tab (browsers only allow it on a user gesture), and steps aside
 * once full screen (Échap to leave).
 */
export function FullscreenButton() {
  const { t } = useTranslation("session", { keyPrefix: "pane" });
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (fullscreen || !document.fullscreenEnabled) return null;
  return (
    <Button
      size="icon"
      variant="outline"
      className="bg-background/90 size-8 rounded-full backdrop-blur"
      aria-label={t("fullscreen")}
      title={t("fullscreen")}
      onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
    >
      <MaximizeIcon className="size-4" />
    </Button>
  );
}

/** GM: a pill saying the players' map is shown in another tab. */
export function ProjectingBadge() {
  const { t } = useTranslation("session", { keyPrefix: "pane" });
  return (
    <span
      id="session-projecting"
      className="bg-background/90 text-muted-foreground flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs backdrop-blur"
    >
      <CastIcon className="size-3.5" /> {t("projecting")}
    </span>
  );
}

/**
 * Stands in for the map when this tab doesn't show it (open in another tab, or
 * turned off on this device): says why, and keeps the map's menu in reach.
 */
export function SessionViewBar({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <div
      id="session-view-bar"
      className="bg-muted/30 flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm"
    >
      <span className="text-muted-foreground flex min-w-0 items-center gap-2">{label}</span>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** In a detached tab, once the main view is gone: offer to become it. */
export function MainViewClosedBanner({ onShowMain }: { onShowMain: () => void }) {
  const { t } = useTranslation("session", { keyPrefix: "pane" });
  return (
    <div
      id="session-main-closed"
      role="status"
      className="bg-background/95 fixed top-3 left-1/2 z-50 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-full border py-1 pr-1 pl-4 text-sm shadow-md backdrop-blur"
    >
      <span className="text-muted-foreground">{t("mainClosed")}</span>
      <Button size="sm" className="h-7 rounded-full" onClick={onShowMain}>
        {t("showMain")}
      </Button>
    </div>
  );
}
