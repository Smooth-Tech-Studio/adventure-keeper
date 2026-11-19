import { describe, expect, it } from "vitest";

import {
  campaignChronicleMarkdown,
  chronicleMarkdown,
  type ChronicleChapter,
} from "@/lib/chronicle-markdown";

const labels = {
  session: (n: number, title?: string) => (title ? `Séance ${n} : ${title}` : `Séance ${n}`),
  playedOn: (date: string) => `Jouée le ${date}`,
  present: "Présents :",
  places: "Lieux :",
  events: "Temps forts",
  documents: "Documents remis :",
  loot: "Butin :",
  defeated: "Vaincus :",
  quests: "Quêtes :",
  quotes: "Citations",
  journalOf: (name: string, title?: string) =>
    title ? `Journal de ${name} — ${title}` : `Journal de ${name}`,
};

const chapter: ChronicleChapter = {
  sessionId: "s1",
  number: 1,
  title: "Le gué",
  playedAt: 1,
  gameDate: "12 du mois des Brumes",
  recap: "Nous avons croisé [[Garrick]].",
  attendees: ["Thorin", "Mira"],
  places: ["Le portail"],
  events: [{ title: "L'embuscade", description: "Des [[gobelins]] !" }],
  documents: ["La lettre scellée"],
  loot: ["Épée ×2"],
  defeated: ["Gobelin ×2"],
  quests: ["Le trésor : accomplie"],
  quotes: [{ text: "On court !", speaker: "Thorin" }],
  journals: [{ characterName: "Thorin", body: "J'ai eu peur." }],
};

describe("chronicleMarkdown", () => {
  it("writes the book: chapters, facts, quotes and journals, mentions as plain text", () => {
    const text = chronicleMarkdown(
      { adventure: "L'entrée", campaign: "La Crypte" },
      [chapter],
      labels,
      () => "14 octobre 2026",
    );
    expect(text).toBe(
      [
        "# L'entrée",
        "",
        "_La Crypte_",
        "",
        "## Séance 1 : Le gué",
        "",
        "_Jouée le 14 octobre 2026 · 12 du mois des Brumes_",
        "",
        "**Présents :** Thorin, Mira",
        "",
        "**Lieux :** Le portail",
        "",
        "Nous avons croisé Garrick.",
        "",
        "### Temps forts",
        "",
        "- **L'embuscade** — Des gobelins !",
        "",
        "**Vaincus :** Gobelin ×2",
        "",
        "**Quêtes :** Le trésor : accomplie",
        "",
        "**Documents remis :** La lettre scellée",
        "",
        "**Butin :** Épée ×2",
        "",
        "### Citations",
        "",
        "> « On court ! » — Thorin",
        "",
        "### Journal de Thorin",
        "",
        "J'ai eu peur.",
        "",
      ].join("\n"),
    );
  });

  it("leaves out what a session does not have", () => {
    const text = chronicleMarkdown(
      { adventure: "A", campaign: "C" },
      [
        {
          ...chapter,
          title: undefined,
          gameDate: undefined,
          attendees: [],
          places: [],
          events: [],
          documents: [],
          loot: [],
          defeated: [],
          quests: [],
          quotes: [],
          journals: [],
        },
      ],
      labels,
      () => "1er janvier",
    );
    expect(text).toBe(
      "# A\n\n_C_\n\n## Séance 1\n\n_Jouée le 1er janvier_\n\nNous avons croisé Garrick.\n",
    );
  });

  it("writes the campaign book: adventures, then their sessions one level down", () => {
    const text = campaignChronicleMarkdown(
      { campaign: "La Crypte" },
      [
        {
          adventure: "L'entrée",
          summary: "Le début.",
          chapters: [
            {
              ...chapter,
              attendees: [],
              places: [],
              events: [],
              documents: [],
              loot: [],
              defeated: [],
              quests: [],
              quotes: [{ text: "On court !" }],
              journals: [],
            },
          ],
        },
        { adventure: "Le puits", chapters: [] },
      ],
      labels,
      () => "14 octobre 2026",
    );
    expect(text).toBe(
      [
        "# La Crypte",
        "",
        "## L'entrée",
        "",
        "_Le début._",
        "",
        "### Séance 1 : Le gué",
        "",
        "_Jouée le 14 octobre 2026 · 12 du mois des Brumes_",
        "",
        "Nous avons croisé Garrick.",
        "",
        "#### Citations",
        "",
        "> « On court ! »",
        "",
        "## Le puits",
        "",
      ].join("\n"),
    );
  });
});
