import {
  ADVENTURE_FILE_FORMAT,
  CAMPAIGN_FILE_FORMAT,
  EXAMPLE_CAMPAIGN_FILE,
  campaignFileToJson,
  type AdventureFile,
  type CampaignFile,
  type FileAdventure,
} from "@adventure-keeper/schemas";

import {
  addEnemy,
  addEvent,
  addLocation,
  addNpc,
  createAdventure,
  getAdventure,
  listAdventures,
  listEnemies,
  listEvents,
  listLocations,
  listNpcs,
} from "@/lib/adventures";
import { fileAdventureOf } from "@/lib/campaign-file-build";
import { addCodexEntry, getCodexSecret, listCodex, setCodexReputation } from "@/lib/codex";
import { getCampaign } from "@/lib/collections";
import { downloadTextFile } from "@/lib/download";
import { listCampaignPacks } from "@/systems/dnd2024/lib/packs";
import { addQuest, listQuests } from "@/lib/quests";

async function readAdventure(
  campaignId: string,
  adventureId: string,
  title: string,
  summary?: string,
) {
  const [locations, enemies, npcs, events] = await Promise.all([
    listLocations(campaignId, adventureId, { gm: true }),
    listEnemies(campaignId, adventureId),
    listNpcs(campaignId, adventureId),
    listEvents(campaignId, adventureId),
  ]);
  return fileAdventureOf({ title, summary, locations, enemies, npcs, events });
}

/** The packs a campaign allows, as a file cites them. */
async function packRefs(campaignId: string) {
  return (await listCampaignPacks(campaignId)).map((copy) => ({
    id: copy.packId,
    name: copy.name,
    version: copy.version,
  }));
}

/** GM: the campaign's preparation as a file — to reuse it or give it to another GM. */
export async function exportCampaignFile(campaignId: string): Promise<CampaignFile> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  const [adventures, codex, quests, packs] = await Promise.all([
    listAdventures(campaignId),
    listCodex(campaignId, true),
    listQuests(campaignId, true),
    packRefs(campaignId),
  ]);
  const secrets = await Promise.all(codex.map((entry) => getCodexSecret(campaignId, entry.id)));
  return {
    format: CAMPAIGN_FILE_FORMAT,
    campaign: {
      name: campaign.name,
      description: campaign.description || undefined,
      system: campaign.system,
      systemLabel: campaign.systemLabel || undefined,
      characterSystem: campaign.characterSystem,
    },
    packs,
    adventures: await Promise.all(
      adventures.map((a) => readAdventure(campaignId, a.id, a.title, a.summary)),
    ),
    codex: codex.map((entry, index) => ({
      kind: entry.kind,
      name: entry.name,
      summary: entry.summary || undefined,
      secret: secrets[index] || undefined,
      imageUrl: entry.imageUrl,
      url: entry.url,
      reputation: entry.reputation,
    })),
    // The campaign's quests; the players' own stay with this table.
    quests: quests
      .filter((quest) => !quest.ownerUid)
      .map((quest) => ({
        title: quest.title,
        summary: quest.summary || undefined,
        status: quest.status,
      })),
  };
}

/** GM: one adventure as a file, to add it to another campaign. */
export async function exportAdventureFile(
  campaignId: string,
  adventureId: string,
): Promise<AdventureFile> {
  const adventure = await getAdventure(campaignId, adventureId);
  if (!adventure) throw new Error("ADVENTURE_NOT_FOUND");
  return {
    format: ADVENTURE_FILE_FORMAT,
    packs: await packRefs(campaignId),
    adventure: await readAdventure(campaignId, adventureId, adventure.title, adventure.summary),
  };
}

/**
 * Create an adventure and what it holds from a file. Locations first: their
 * new ids replace the names enemies and NPCs refer to. Returns the new id and
 * how many pieces could not be written.
 */
export async function importAdventure(
  campaignId: string,
  adventure: FileAdventure,
  createdBy: string,
): Promise<{ adventureId: string; failures: number }> {
  const adventureId = await createAdventure(
    campaignId,
    { title: adventure.title, summary: adventure.summary },
    createdBy,
  );
  let failures = 0;
  const locationIds = new Map<string, string>();
  for (const [index, location] of adventure.locations.entries()) {
    try {
      locationIds.set(location.name, await addLocation(campaignId, adventureId, location, index));
    } catch (error) {
      console.error(error);
      failures += 1;
    }
  }
  const at = (name?: string) => (name ? locationIds.get(name) : undefined);
  const rest = await Promise.allSettled([
    ...adventure.enemies.map(({ location, speed, ...enemy }) =>
      addEnemy(campaignId, adventureId, { ...enemy, speed: speed ?? 9, locationId: at(location) }),
    ),
    ...adventure.npcs.map(({ location, ...npc }, index) =>
      addNpc(campaignId, adventureId, { ...npc, locationId: at(location) }, index),
    ),
    ...adventure.events.map((event, index) =>
      addEvent(
        campaignId,
        adventureId,
        {
          title: event.title,
          description: event.description ?? "",
          trigger: event.trigger ?? "",
          dueDay: event.dueDay,
          dueTime: event.dueTime,
        },
        index,
      ),
    ),
  ]);
  failures += rest.filter((r) => r.status === "rejected").length;
  return { adventureId, failures };
}

/**
 * Fill a campaign just created from a file: its adventures in order, the
 * codex (every entry hidden, its secret kept) and the quests (hidden).
 * Returns how many pieces could not be written.
 */
export async function importCampaignContent(
  campaignId: string,
  file: CampaignFile,
  createdBy: string,
): Promise<number> {
  let failures = 0;
  for (const adventure of file.adventures) {
    try {
      failures += (await importAdventure(campaignId, adventure, createdBy)).failures;
    } catch (error) {
      console.error(error);
      failures += 1;
    }
  }
  const rest = await Promise.allSettled([
    ...file.codex.map(async (entry) => {
      const id = await addCodexEntry(campaignId, {
        kind: entry.kind,
        name: entry.name,
        summary: entry.summary ?? "",
        imageUrl: entry.imageUrl ?? "",
        url: entry.url ?? "",
        secret: entry.secret ?? "",
      });
      if (entry.reputation !== undefined) {
        await setCodexReputation(campaignId, id, entry.reputation);
      }
    }),
    ...file.quests.map((quest, index) =>
      addQuest(
        campaignId,
        {
          title: quest.title,
          summary: quest.summary ?? "",
          status: quest.status ?? "rumor",
          revealed: false,
        },
        index,
      ),
    ),
  ]);
  return failures + rest.filter((r) => r.status === "rejected").length;
}

/** What a file brings, in numbers — for the summary before importing. */
export function fileCounts(adventures: readonly FileAdventure[]) {
  const sum = (pick: (a: FileAdventure) => unknown[]) =>
    adventures.reduce((total, a) => total + pick(a).length, 0);
  return {
    adventures: adventures.length,
    locations: sum((a) => a.locations),
    enemies: sum((a) => a.enemies),
    npcs: sum((a) => a.npcs),
    events: sum((a) => a.events),
  };
}

/** Save a file as `.json`, named after what it holds. */
export function downloadJsonFile(name: string, text: string): void {
  downloadTextFile(`${name.replace(/[\\/:*?"<>|]+/g, "-")}.json`, text, "application/json");
}

/** The example adventure file: the first adventure of the example campaign. */
export const EXAMPLE_ADVENTURE_FILE: AdventureFile = {
  format: ADVENTURE_FILE_FORMAT,
  packs: [],
  adventure: EXAMPLE_CAMPAIGN_FILE.adventures[0],
};

/** Save the example campaign or adventure file, to start one from it. */
export function downloadExampleFile(kind: "campaign" | "adventure"): void {
  if (kind === "campaign") {
    downloadJsonFile(
      EXAMPLE_CAMPAIGN_FILE.campaign.name,
      campaignFileToJson(EXAMPLE_CAMPAIGN_FILE),
    );
  } else {
    downloadJsonFile(
      EXAMPLE_ADVENTURE_FILE.adventure.title,
      campaignFileToJson(EXAMPLE_ADVENTURE_FILE),
    );
  }
}
