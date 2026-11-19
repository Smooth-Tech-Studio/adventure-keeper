import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  campaignFileToJson,
  type AdventureFile,
  type CampaignFile,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { downloadJsonFile } from "@/lib/campaign-file";

/**
 * GM: save the campaign's (or one adventure's) preparation as a `.json` file —
 * to start another campaign from it, or give it to another GM.
 */
export function ExportFileButton({
  label,
  name,
  load,
}: {
  label: string;
  /** The file's name, without `.json`. */
  name: string;
  load: () => Promise<CampaignFile | AdventureFile>;
}) {
  const { t } = useTranslation("campaigns");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          downloadJsonFile(name, campaignFileToJson(await load()));
        } catch (error) {
          console.error(error);
          toast.error(t("export.failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <DownloadIcon /> {label}
    </Button>
  );
}
