import { useEffect, useState } from "react";
import { CheckCircle2Icon, LaptopIcon, LoaderIcon, ServerIcon, XCircleIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkRealtimeServer,
  findLocalServer,
  localServerAllowed,
} from "@/lib/realtime/room-client";

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const storageKey = (campaignId: string) => `session-realtime-url:${campaignId}`;

function rememberedUrl(campaignId: string): string {
  try {
    return localStorage.getItem(storageKey(campaignId)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Starting a session through a self-hosted realtime server: its address, a
 * « Tester » that asks it `/health`, then « Démarrer ». The address is kept on
 * this device for the campaign. Without it, sessions play on Firestore.
 * « Chercher sur cet ordinateur » asks Adventure Keeper Serveur (the desktop
 * app) for its public address. On a click only, as Chrome asks the user
 * before a site reaches this computer — unless that was already allowed: then
 * it asks as the dialog opens, and offers the address.
 */
export function RealtimeStartDialog({
  campaignId,
  disabled,
  onStart,
}: {
  campaignId: string;
  disabled?: boolean;
  onStart: (url: string) => void;
}) {
  const { t } = useTranslation("adventures", { keyPrefix: "realtime" });
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(() => rememberedUrl(campaignId));
  const [check, setCheck] = useState<"idle" | "checking" | "ok" | "ko">("idle");
  const [local, setLocal] = useState<
    { status: "idle" | "searching" | "none" } | { status: "found"; url: string }
  >({ status: "idle" });

  const applyAddress = (address: string) => {
    setUrl(address);
    setCheck("ok");
  };

  const search = async (fill: boolean) => {
    setLocal({ status: "searching" });
    const found = await findLocalServer();
    setLocal(found ? { status: "found", url: found } : { status: "none" });
    if (found && fill) applyAddress(found);
  };

  // The app's address changes at each launch: asked again at each opening.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLocal({ status: "idle" });
    void localServerAllowed().then(async (allowed) => {
      if (!allowed || !live) return;
      const found = await findLocalServer();
      if (live) setLocal(found ? { status: "found", url: found } : { status: "none" });
    });
    return () => {
      live = false;
    };
  }, [open]);

  const valid = isHttpUrl(url.trim());
  // An https page cannot open a ws:// socket: say so before it fails.
  const mixed = valid && window.location.protocol === "https:" && url.trim().startsWith("http:");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={t("open")}
          title={t("open")}
        >
          <ServerIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
            <LaptopIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              {local.status === "found"
                ? local.url === url.trim()
                  ? t("localInUse")
                  : t("local")
                : local.status === "none"
                  ? t("localNone")
                  : t("localAsk")}
            </span>
            {local.status === "found" ? (
              local.url !== url.trim() && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applyAddress(local.url)}
                >
                  {t("useLocal")}
                </Button>
              )
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={local.status === "searching"}
                onClick={() => void search(true)}
              >
                {local.status === "searching" && <LoaderIcon className="animate-spin" />}
                {local.status === "none" ? t("localRetry") : t("localSearch")}
              </Button>
            )}
          </div>
          <Label htmlFor="realtime-url">{t("url")}</Label>
          <div className="flex gap-2">
            <Input
              id="realtime-url"
              type="url"
              inputMode="url"
              placeholder="https://jeu.example.org"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setCheck("idle");
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!valid || check === "checking"}
              onClick={async () => {
                setCheck("checking");
                setCheck((await checkRealtimeServer(url.trim())) ? "ok" : "ko");
              }}
            >
              {t("test")}
            </Button>
          </div>
          {check === "ok" && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" /> {t("ok")}
            </p>
          )}
          {check === "ko" && (
            <p className="text-destructive flex items-center gap-1.5 text-sm">
              <XCircleIcon className="size-4" /> {t("ko")}
            </p>
          )}
          {mixed && <p className="text-destructive text-sm">{t("mixed")}</p>}
          <p className="text-muted-foreground text-xs">
            <Trans
              t={t}
              i18nKey="hint"
              components={{
                download: (
                  <Link
                    to="/serveur"
                    target="_blank"
                    className="text-foreground underline underline-offset-4"
                  />
                ),
              }}
            />
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!valid || mixed || disabled}
            onClick={() => {
              const value = url.trim().replace(/\/$/, "");
              try {
                localStorage.setItem(storageKey(campaignId), value);
              } catch {
                // Not remembered on this device: fine.
              }
              setOpen(false);
              onStart(value);
            }}
          >
            {t("start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
