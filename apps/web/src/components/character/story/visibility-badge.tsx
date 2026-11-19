import { LockIcon, ShieldIcon, UsersIcon } from "lucide-react";
import type { StoryVisibility } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";

const ICONS = { private: LockIcon, gm: ShieldIcon, party: UsersIcon } as const;

/** Who reads a chapter / journal entry: « Moi seul », « MJ · La Crypte »… */
export function StoryVisibilityBadge({
  visibility,
  campaignName,
}: {
  visibility: StoryVisibility;
  campaignName?: string;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "story" });
  const Icon = ICONS[visibility];
  const label = t(`badges.${visibility}`);
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="size-3" />
      {visibility !== "private" && campaignName ? `${label} · ${campaignName}` : label}
    </Badge>
  );
}
