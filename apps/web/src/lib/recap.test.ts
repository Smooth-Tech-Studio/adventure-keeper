import { describe, expect, it } from "vitest";
import { sessionNumbers } from "@adventure-keeper/schemas";

import i18n from "@/i18n";
import { recapExcerpt, recapSkeleton, sessionFacts } from "@/lib/recap";

const participants = [
  { playerId: "p1", characterName: "Thorin" },
  { playerId: "p2", characterName: "Lyra" },
  { playerId: "p3", characterName: "Bram" },
];

describe("sessionFacts", () => {
  it("keeps the characters whose player joined, the places in visit order, the revealed beats", async () => {
    await i18n.changeLanguage("fr");
    const facts = sessionFacts(
      {
        id: "s1",
        attendeeUids: ["gm", "p2", "p1"],
        visitedLocationIds: ["crypt", "village", "unknown"],
        revealedEvents: [{ eventId: "e1", title: "L'embuscade" }],
        loot: [
          { id: "l1", name: "Épée elfique", quantity: 2 },
          { id: "l2", name: "Carte" },
        ],
        defeated: [
          { id: "c1", name: "Gobelin" },
          { id: "c2", name: "Ogre" },
          { id: "c3", name: "Gobelin 2" },
        ],
      },
      participants,
      [
        { locationId: "village", name: "Village" },
        { locationId: "crypt", name: "Crypte" },
      ],
      [
        {
          title: "Le trésor",
          milestones: [
            { kind: "revealed", adventureId: "a", sessionId: "s1", sessionNumber: 1 },
            { kind: "done", adventureId: "a", sessionId: "s1", sessionNumber: 1 },
          ],
        },
        {
          title: "Plus tard",
          milestones: [{ kind: "active", adventureId: "a", sessionId: "s2" }],
        },
      ],
    );
    expect(facts).toEqual({
      attendees: ["Thorin", "Lyra"],
      places: ["Crypte", "Village"],
      events: ["L'embuscade"],
      loot: ["Épée elfique ×2", "Carte"],
      defeated: ["Gobelin ×2", "Ogre"],
      quests: ["Le trésor : révélée, accomplie"],
    });
  });

  it("reads a session written before attendees were tracked as nobody", () => {
    const facts = sessionFacts(
      {
        id: "s1",
        attendeeUids: [],
        visitedLocationIds: [],
        revealedEvents: [],
        loot: [],
        defeated: [],
      },
      participants,
      [],
    );
    expect(facts.attendees).toEqual([]);
  });
});

describe("recapSkeleton", () => {
  it("lists the known facts then leaves room for the story", async () => {
    await i18n.changeLanguage("fr");
    const text = recapSkeleton({
      attendees: ["Thorin", "Lyra"],
      places: ["Crypte", "Village"],
      events: ["L'embuscade"],
      loot: ["Carte"],
      defeated: ["Gobelin ×2"],
      quests: ["Le trésor : accomplie"],
    });
    expect(text).toBe(
      [
        "**Présents :** Thorin, Lyra",
        "",
        "**Lieux :** Crypte → Village",
        "",
        "**Temps forts :**",
        "",
        "- L'embuscade",
        "",
        "**Vaincus :** Gobelin ×2",
        "",
        "**Quêtes :**",
        "",
        "- Le trésor : accomplie",
        "",
        "**Butin :** Carte",
        "",
        "_Racontez ici ce qui s'est passé…_",
      ].join("\n"),
    );
  });

  it("leaves out what the app does not know", async () => {
    await i18n.changeLanguage("en");
    expect(
      recapSkeleton({ attendees: [], places: [], events: [], loot: [], defeated: [], quests: [] }),
    ).toBe("_Tell what happened here…_");
  });
});

describe("sessionNumbers", () => {
  const ms = (value: unknown) => value as number;

  it("keeps a stored number and ranks older sessions by start time", () => {
    const numbers = sessionNumbers(
      [
        { id: "c", startedAt: 30, number: 7 },
        { id: "a", startedAt: 10 },
        { id: "b", startedAt: 20 },
      ],
      ms,
    );
    expect(Object.fromEntries(numbers)).toEqual({ a: 1, b: 2, c: 7 });
  });
});

describe("recapExcerpt", () => {
  it("drops the Markdown and the codex brackets", () => {
    expect(
      recapExcerpt("## Le gué\n\nLe groupe croise **[[Frère Osric]]** au [moulin](https://x.y)."),
    ).toBe("Le gué Le groupe croise Frère Osric au moulin.");
  });

  it("cuts a long recap on a word", () => {
    expect(recapExcerpt("un deux trois quatre", 12)).toBe("un deux…");
  });
});
