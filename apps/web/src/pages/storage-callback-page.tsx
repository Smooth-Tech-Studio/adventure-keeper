import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/page-container";
import { useAuth } from "@/hooks/use-auth";
import { saveStorageConnection } from "@/lib/image-storage";
import { finishDropboxConnect } from "@/lib/image-storage/dropbox";

/** Dropbox sends the player back here (`?code=…`): save the link, return where they were. */
export function StorageCallbackPage() {
  const { t } = useTranslation("profile", { keyPrefix: "storage" });
  const { user } = useAuth();
  const navigate = useNavigate();
  // The code can be traded once: React's double effect must not try twice.
  const done = useRef(false);

  useEffect(() => {
    if (!user || done.current) return;
    done.current = true;
    finishDropboxConnect(new URLSearchParams(window.location.search))
      .then(async ({ connection, returnTo }) => {
        await saveStorageConnection(user.uid, connection);
        toast.success(t("connectedToast"));
        navigate(returnTo || "/profil", { replace: true });
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(t("failed"), {
          description: error instanceof Error ? error.message : undefined,
        });
        navigate("/profil", { replace: true });
      });
  }, [user, navigate, t]);

  return (
    <PageContainer>
      <p className="text-muted-foreground text-sm">{t("finishing")}</p>
    </PageContainer>
  );
}
