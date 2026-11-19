import { DownloadIcon } from "lucide-react";
import {
  ADVENTURE_FILE_FORMAT,
  CAMPAIGN_FILE_FORMAT,
  CHARACTER_SYSTEMS,
  CODEX_KINDS,
  EXAMPLE_CAMPAIGN_FILE,
  QUEST_STATUSES,
  campaignFileToJson,
  fileSystemName,
  gameSystemSchema,
} from "@adventure-keeper/schemas";
import { CREATURE_SIZES } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/page-container";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { downloadExampleFile } from "@/lib/campaign-file";

/** The fields of each object, in file order; « ? » marks an optional one. */
const OBJECTS = {
  campaign: ["name", "description?", "system", "systemLabel?", "characterSystem"],
  adventure: ["title", "summary?", "locations?", "enemies?", "npcs?", "events?"],
  location: ["name", "description?", "imageUrl?", "hidden?", "loot?"],
  enemy: [
    "name",
    "armorClass",
    "maxHitPoints",
    "speed?",
    "location?",
    "sourceMonsterId?",
    "size?",
    "challengeRating?",
    "abilityScores?",
    "attacks?",
    "color?",
    "description?",
    "imageUrl?",
    "notes?",
    "loot?",
  ],
  npc: ["name", "personality?", "lore?", "location?", "color?"],
  event: ["title", "description?", "trigger?", "dueDay?", "dueTime?"],
  codex: ["kind", "name", "summary?", "secret?", "imageUrl?", "url?", "reputation?"],
  quest: ["title", "summary?", "status?"],
  pack: ["id", "name?", "version?"],
} as const;

/** Values a field accepts, listed under the objects that use them. */
const VALUES: Record<string, readonly string[]> = {
  system: gameSystemSchema.options.map(fileSystemName),
  characterSystem: CHARACTER_SYSTEMS.map(fileSystemName),
  size: CREATURE_SIZES,
  kind: CODEX_KINDS,
  status: QUEST_STATUSES,
};

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-muted max-h-[32rem] overflow-auto rounded-lg p-3 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

/**
 * `/campaigns/format` — how a campaign or adventure file is written: the two
 * formats, every object with its fields, the values a field accepts (read from
 * the schemas themselves), and the example, which the tests parse.
 */
export function CampaignFormatPage() {
  const { t } = useTranslation(["campaigns", "common"]);
  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: t("format.title") },
  ]);
  return (
    <PageContainer size="form" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("format.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("format.intro")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("format.twoFiles")}</CardTitle>
          <CardDescription>{t("format.twoFilesIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            <code className="font-mono">{CAMPAIGN_FILE_FORMAT}</code> — {t("format.campaignFile")}
          </p>
          <p>
            <code className="font-mono">{ADVENTURE_FILE_FORMAT}</code> — {t("format.adventureFile")}
          </p>
          <p className="text-muted-foreground">{t("format.notIncluded")}</p>
          <p className="text-muted-foreground">{t("format.strict")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadExampleFile("campaign")}
            >
              <DownloadIcon /> {t("format.downloadCampaign")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadExampleFile("adventure")}
            >
              <DownloadIcon /> {t("format.downloadAdventure")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(Object.keys(OBJECTS) as (keyof typeof OBJECTS)[]).map((object) => (
        <Card key={object}>
          <CardHeader>
            <CardTitle>{t(`format.objects.${object}.title`)}</CardTitle>
            <CardDescription>{t(`format.objects.${object}.intro`)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(9rem,auto)_1fr]">
              {OBJECTS[object].map((field) => {
                const key = field.replace("?", "");
                return (
                  <div key={field} className="contents">
                    <dt className="font-mono text-xs leading-6">{field}</dt>
                    <dd className="text-muted-foreground">
                      {t(`format.fields.${object}.${key}` as "format.title")}
                      {VALUES[key] && (
                        <span className="mt-0.5 block font-mono text-xs">
                          {VALUES[key].join(" · ")}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>{t("format.example")}</CardTitle>
          <CardDescription>{t("format.exampleIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Code>{campaignFileToJson(EXAMPLE_CAMPAIGN_FILE)}</Code>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
