import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setCodexReputation } from "@/lib/codex";

const LEVELS = [-3, -2, -1, 0, 1, 2, 3] as const;

/** A faction's attitude toward the party, as a coloured badge. */
export function ReputationBadge({ value }: { value: number | undefined }) {
  const { t } = useTranslation("codex", { keyPrefix: "reputation" });
  if (value === undefined) return null;
  const tone =
    value < 0
      ? "border-destructive/40 text-destructive"
      : value > 0
        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
        : "";
  return (
    <Badge variant="outline" className={`font-normal ${tone}`}>
      {t(`levels.${value}` as "levels.0")}
    </Badge>
  );
}

/** GM: set or clear a faction's attitude toward the party. */
export function ReputationSelect({
  campaignId,
  entryId,
  value,
}: {
  campaignId: string;
  entryId: string;
  value: number | undefined;
}) {
  const { t } = useTranslation(["codex", "common"]);
  return (
    <Select
      value={value === undefined ? "none" : String(value)}
      onValueChange={(next) =>
        setCodexReputation(campaignId, entryId, next === "none" ? null : Number(next)).catch(
          (error) => {
            console.error(error);
            toast.error(t("common:saveFailed"));
          },
        )
      }
    >
      <SelectTrigger size="sm" className="w-44" aria-label={t("reputation.label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t("reputation.none")}</SelectItem>
        {LEVELS.map((level) => (
          <SelectItem key={level} value={String(level)}>
            {t(`reputation.levels.${level}` as "reputation.levels.0")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
