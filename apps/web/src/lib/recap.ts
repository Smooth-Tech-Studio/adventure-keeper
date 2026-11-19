import type {
  AdventureParticipant,
  DefeatedEnemy,
  LiveSession,
  LootItem,
  Quest,
  SessionMapReveal,
} from "@adventure-keeper/schemas";
import type { WithId } from "@adventure-keeper/schemas";

import { tr } from "@/i18n";
import { questsOfSession } from "@/lib/quest-milestones";

/** What the app knows of a played session, in words a recap can reuse. */
export interface SessionFacts {
  /** Characters whose player joined the session. */
  attendees: string[];
  /** Locations shown, in first-visit order. */
  places: string[];
  /** Story beats the GM revealed. */
  events: string[];
  /** What the party found (« Épée elfique ×2 »). */
  loot: string[];
  /** Enemies that fell (« Gobelin ×3 »). */
  defeated: string[];
  /** Quests that moved (« Le trésor d'Ashmoor : accomplie »). */
  quests: string[];
}

/**
 * « Gobelin ×3, Ogre » — numbered copies of one enemy (« Gobelin 2 ») count
 * together, in the order they first fell.
 */
export function defeatedSummary(defeated: readonly Pick<DefeatedEnemy, "name">[]): string[] {
  const counts = new Map<string, number>();
  for (const enemy of defeated) {
    const name = enemy.name.replace(/\s+\d+$/, "");
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name));
}

/** « Épée elfique ×2 (la crypte) » — the quantity and the place when known. */
export function lootLabel(
  item: Pick<LootItem, "name" | "quantity" | "where" | "recipient">,
): string {
  const name = item.quantity ? `${item.name} ×${item.quantity}` : item.name;
  const where = item.where ? `${name} (${item.where})` : name;
  // Given by the GM: who took it.
  return item.recipient ? `${where} → ${item.recipient}` : where;
}

export function sessionFacts(
  session: Pick<
    WithId<LiveSession>,
    "id" | "attendeeUids" | "visitedLocationIds" | "revealedEvents" | "loot" | "defeated"
  >,
  participants: Pick<AdventureParticipant, "playerId" | "characterName">[],
  reveals: Pick<WithId<SessionMapReveal>, "locationId" | "name">[],
  quests: readonly Pick<Quest, "title" | "milestones">[] = [],
): SessionFacts {
  const attendeeUids = new Set(session.attendeeUids ?? []);
  return {
    attendees: participants.filter((p) => attendeeUids.has(p.playerId)).map((p) => p.characterName),
    places: (session.visitedLocationIds ?? [])
      .map((id) => reveals.find((r) => r.locationId === id)?.name)
      .filter((name): name is string => Boolean(name)),
    events: (session.revealedEvents ?? []).map((e) => e.title),
    loot: (session.loot ?? []).map(lootLabel),
    defeated: defeatedSummary(session.defeated ?? []),
    quests: questsOfSession(quests, session.id),
  };
}

/**
 * A Markdown skeleton for the recap, filled with the session facts: the GM
 * only has to write the story around it. Empty facts are left out.
 */
export function recapSkeleton(facts: SessionFacts): string {
  const lines: string[] = [];
  if (facts.attendees.length > 0) {
    lines.push(`**${tr("adventures:recap.prefillAttendees")}** ${facts.attendees.join(", ")}`, "");
  }
  if (facts.places.length > 0) {
    lines.push(`**${tr("adventures:recap.prefillPlaces")}** ${facts.places.join(" → ")}`, "");
  }
  if (facts.events.length > 0) {
    lines.push(`**${tr("adventures:recap.prefillEvents")}**`, "");
    for (const event of facts.events) lines.push(`- ${event}`);
    lines.push("");
  }
  if (facts.defeated.length > 0) {
    lines.push(`**${tr("adventures:recap.prefillDefeated")}** ${facts.defeated.join(", ")}`, "");
  }
  if (facts.quests.length > 0) {
    lines.push(`**${tr("adventures:recap.prefillQuests")}**`, "");
    for (const quest of facts.quests) lines.push(`- ${quest}`);
    lines.push("");
  }
  if (facts.loot.length > 0) {
    lines.push(`**${tr("adventures:recap.prefillLoot")}** ${facts.loot.join(", ")}`, "");
  }
  lines.push(tr("adventures:recap.prefillStory"));
  return lines.join("\n");
}

/**
 * A recap's first lines as plain text, for a teaser: the Markdown marks and
 * `[[codex]]` brackets dropped, cut on a word with « … » past `max` characters.
 */
export function recapExcerpt(markdown: string, max = 220): string {
  const text = markdown
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_, name: string, label?: string) => label ?? name,
    )
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
}
