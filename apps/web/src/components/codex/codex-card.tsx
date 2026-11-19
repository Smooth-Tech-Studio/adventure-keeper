import { Link } from "react-router-dom";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import type { CodexEntry } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaign/campaign-card";
import { CodexEntryRow } from "@/components/codex/codex-entry-row";
import { codexPath } from "@/hooks/use-codex";
import type { WithId } from "@/lib/collections";
import { toMillis } from "@/lib/firestore";

/** How many entries the card lists. */
const RECENT = 5;

/** Campaign page: the entries discovered last, each a link, and the way into the codex. */
export function CodexCard({
  campaignId,
  isGm,
  entries,
  titled = true,
}: {
  campaignId: string;
  isGm: boolean;
  /** The codex this reader sees (`useCodex`). */
  entries: WithId<CodexEntry>[];
  /** Off in a phone's tab, which names it already. */
  titled?: boolean;
}) {
  const { t } = useTranslation("codex");
  const recent = [...entries]
    .sort(
      (a, b) =>
        toMillis(b.revealedAt ?? b.updatedAt ?? b.createdAt) -
        toMillis(a.revealedAt ?? a.updatedAt ?? a.createdAt),
    )
    .slice(0, RECENT);
  const open = (
    <Button asChild size="sm" variant="ghost">
      <Link to={codexPath(campaignId)}>
        {t("card.open")} <ChevronRightIcon />
      </Link>
    </Button>
  );

  return (
    <CampaignCard title={titled ? t("card.title") : undefined} icon={BookOpenIcon} action={open}>
      {!titled && <div className="-mt-1 mb-1 flex justify-end">{open}</div>}
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{isGm ? t("emptyGm") : t("empty")}</p>
      ) : (
        <>
          <p className="text-muted-foreground mb-1 text-xs">{t("card.recent")}</p>
          <ul>
            {recent.map((entry) => (
              <CodexEntryRow key={entry.id} entry={entry} to={codexPath(campaignId, entry.id)} />
            ))}
          </ul>
        </>
      )}
    </CampaignCard>
  );
}
