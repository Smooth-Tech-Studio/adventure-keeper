import { useState } from "react";
import { LogOutIcon, SquareIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SessionChrome } from "@/hooks/use-session-chrome";

/** The "En direct" control the navbar shows while a live session is open. */
export function SessionNavControl({ chrome }: { chrome: SessionChrome }) {
  const { t } = useTranslation("session", { keyPrefix: "nav" });
  const [confirmEnd, setConfirmEnd] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <span className={cn("size-2 rounded-full", "animate-pulse bg-green-500")} />
            {t("live")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="font-normal">
            {t("connected", { count: chrome.connectedCount })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {chrome.canControl && (
            <>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmEnd(true)}>
                <SquareIcon /> {t("end")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={chrome.onLeave}>
            <LogOutIcon /> {chrome.leaveLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("endTitle")}</DialogTitle>
            <DialogDescription>{t("endText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmEnd(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmEnd(false);
                chrome.onEnd();
              }}
            >
              {t("end")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
