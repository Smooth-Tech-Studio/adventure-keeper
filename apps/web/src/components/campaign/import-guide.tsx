import { CopyIcon, DownloadIcon, SparklesIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ADVENTURE_FILE_FORMAT, CAMPAIGN_FILE_FORMAT } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { downloadExampleFile } from "@/lib/campaign-file";

/**
 * Under « Importer »: how to get a file without writing it by hand — give the
 * example to an AI, with a description or an adventure in PDF — plus the
 * example itself and the format guide.
 */
export function ImportGuide({ kind }: { kind: "campaign" | "adventure" }) {
  const { t } = useTranslation("campaigns", { keyPrefix: "importGuide" });
  const format = kind === "campaign" ? CAMPAIGN_FILE_FORMAT : ADVENTURE_FILE_FORMAT;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(t(`prompt.${kind}`, { format }));
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-lg p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <SparklesIcon className="size-4" /> {t(`title.${kind}`)}
      </p>
      <p className="text-muted-foreground">{t(`ai.${kind}`)}</p>
      <p className="text-muted-foreground">{t(`pdf.${kind}`)}</p>
      <p className="text-muted-foreground text-xs">{t("rights")}</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={() => downloadExampleFile(kind)}>
          <DownloadIcon /> {t("download")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyPrompt}>
          <CopyIcon /> {t("copyPrompt")}
        </Button>
        <Link to="/campaigns/format" className="underline underline-offset-4">
          {t("formatGuide")}
        </Link>
      </div>
    </div>
  );
}
