import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignListCard } from "@/components/campaign/campaign-list-card";
import { PageContainer } from "@/components/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/page-loading";
import { listMyCampaigns, type WithId } from "@/lib/collections";
import { useAuth } from "@/hooks/use-auth";
import type { Campaign } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

export function CampaignsListPage() {
  const { t } = useTranslation("campaigns", { keyPrefix: "list" });
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<WithId<Campaign>[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setCampaigns(null);
    setError(false);
    listMyCampaigns(user.uid)
      .then((rows) => active && setCampaigns(rows))
      .catch((err) => {
        console.error(err);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("intro")}</p>
        </div>
        <Button asChild>
          <Link to="/campaigns/new">
            <PlusIcon /> {t("new")}
          </Link>
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{t("loadFailed")}</p>}

      {!error && campaigns === null && <ListSkeleton />}

      {!error && campaigns?.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("emptyTitle")}</CardTitle>
            <CardDescription>{t("emptyText")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/campaigns/new">
                <PlusIcon /> {t("create")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
        {campaigns?.map((campaign) => (
          <CampaignListCard
            key={campaign.id}
            campaign={campaign}
            isGm={campaign.ownerId === user?.uid}
          />
        ))}
      </div>
    </PageContainer>
  );
}
