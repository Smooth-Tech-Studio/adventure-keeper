import { LoaderIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * The realtime server is out of reach (a network hiccup, a sleeping laptop, the
 * GM not there yet): the room reconnects by itself; until then, say so.
 */
export function RealtimeReconnecting() {
  const { t } = useTranslation("session", { keyPrefix: "realtime" });
  return (
    <div
      role="status"
      className="bg-background/95 fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/50 px-4 py-2 text-sm shadow-lg"
    >
      <LoaderIcon className="size-4 animate-spin text-amber-500" />
      {t("reconnecting")}
    </div>
  );
}
