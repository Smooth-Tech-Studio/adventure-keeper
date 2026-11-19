import { useState } from "react";
import { CloudIcon, UnplugIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useImageStorage } from "@/hooks/use-image-storage";
import { removeStorageConnection } from "@/lib/image-storage";
import { startDropboxConnect } from "@/lib/image-storage/dropbox";

/**
 * « Stockage des images », on the profile: connect one's Dropbox, so that an
 * image can be imported from the device anywhere the app asks for a link.
 * Hidden when this deployment has no Dropbox app key.
 */
export function ImageStorageCard() {
  const { t } = useTranslation("profile", { keyPrefix: "storage" });
  const { user } = useAuth();
  const { available, connection } = useImageStorage();
  const [busy, setBusy] = useState(false);
  if (!available || !user) return null;

  return (
    <Card id="image-storage">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {connection ? (
          <>
            <CloudIcon className="text-muted-foreground size-5" />
            <span className="min-w-0 flex-1 text-sm">
              {t("connected", { account: connection.accountEmail ?? connection.accountName ?? "" })}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await removeStorageConnection(user.uid);
                  toast.success(t("disconnected"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <UnplugIcon /> {t("disconnect")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={busy || connection === undefined}
            onClick={() => {
              setBusy(true);
              void startDropboxConnect(window.location.pathname).catch(() => {
                setBusy(false);
                toast.error(t("failed"));
              });
            }}
          >
            <CloudIcon /> {t("connect")}
          </Button>
        )}
        <p className="text-muted-foreground basis-full text-xs">{t("privacy")}</p>
      </CardContent>
    </Card>
  );
}
