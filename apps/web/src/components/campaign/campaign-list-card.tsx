import { Link } from "react-router-dom";
import { ShieldIcon, UsersIcon } from "lucide-react";
import { GAME_SYSTEM_LABELS, type Campaign } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WithId } from "@/lib/collections";

/** A campaign in « Mes campagnes »: the reader's role, its name and system, its members, its pitch. */
export function CampaignListCard({
  campaign,
  isGm,
}: {
  campaign: WithId<Campaign>;
  isGm: boolean;
}) {
  const { t } = useTranslation("campaigns", { keyPrefix: "list" });
  return (
    <Link to={`/campaigns/${campaign.id}`} className="block">
      <Card className="hover:bg-muted/40 h-full transition-colors">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant={isGm ? "default" : "secondary"}>
              {isGm ? (
                <>
                  <ShieldIcon /> {t("gm")}
                </>
              ) : (
                t("player")
              )}
            </Badge>
          </div>
          <CardTitle>{campaign.name}</CardTitle>
          <CardDescription>
            {campaign.systemLabel ?? GAME_SYSTEM_LABELS[campaign.system] ?? campaign.system}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-4" />
            {campaign.memberIds?.length ?? 1}
          </span>
          {campaign.description && <span className="line-clamp-1">{campaign.description}</span>}
        </CardContent>
      </Card>
    </Link>
  );
}
