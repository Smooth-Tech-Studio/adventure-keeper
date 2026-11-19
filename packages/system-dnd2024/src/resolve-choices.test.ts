import { describe, expect, it } from "vitest";
import type { ChoicePick } from "./choices";
import { validateChoices, pruneChoicePicks } from "./choices";
import {
  abilityScoreImprovements,
  heldFeatIds,
  resolveChoices,
  resolveChoicesFor,
} from "./resolve-choices";
import { withContent } from "./packs/active";
import { parseContentPack } from "./packs/parse";
import { createContentOverlay } from "./packs/registry";
import BRUMES_PACK from "./packs/fixtures/brumes-du-nord.json";

const brumes = parseContentPack(BRUMES_PACK);
if (!brumes.ok) throw new Error(brumes.errors.join("\n"));
const BRUMES = createContentOverlay([brumes.pack]);

/** A level-1 druid elf criminal — the walkthrough character of the plan. */
const DRUID = { classId: "druid", speciesId: "elf", backgroundId: "criminal", level: 1 };

const ids = (input: Parameters<typeof resolveChoices>[0]) =>
  resolveChoices(input).map((def) => def.id);

describe("resolveChoices", () => {
  it("returns nothing when nothing is chosen yet", () => {
    expect(resolveChoices({})).toEqual([]);
  });

  it("ignores an unknown class, species or background", () => {
    expect(resolveChoices({ classId: "nope", speciesId: "nope", backgroundId: "nope" })).toEqual(
      [],
    );
  });

  it("opens the class skill choice with the class's own list", () => {
    const skills = resolveChoices(DRUID).find((def) => def.id === "class:druid:skills");
    expect(skills).toMatchObject({ source: "class", kind: "skill", count: 2 });
    expect(skills?.pool).toMatchObject({ kind: "list" });
  });

  it("covers class, species and background for the druid elf hermit", () => {
    const result = ids(DRUID);
    // Class: skills + starting equipment.
    expect(result).toContain("class:druid:skills");
    expect(result).toContain("class:druid:equipment");
    // Species: the elven lineage and the « Sens aiguisés » skill.
    expect(result).toContain("species:elf:lineage");
    expect(result).toContain("species:elf:skill");
    // Background: the criminal's tool is fixed, so only the equipment package.
    expect(result).toContain("background:criminal:equipment");
    expect(result).not.toContain("background:criminal:tool");
  });

  it("opens a background tool pick only when the background leaves it open", () => {
    expect(ids({ ...DRUID, backgroundId: "soldier" })).toContain("background:soldier:tool");
    expect(ids({ ...DRUID, backgroundId: "criminal" })).not.toContain("background:criminal:tool");
  });

  it("deduplicates", () => {
    const result = ids(DRUID);
    expect(new Set(result).size).toBe(result.length);
  });
});

describe("level gating", () => {
  it("holds the subclass back until level 3", () => {
    expect(ids({ ...DRUID, level: 2 })).not.toContain("class:druid:subclass");
    expect(ids({ ...DRUID, level: 3 })).toContain("class:druid:subclass");
  });

  it("gives the fighter a style at level 1 but the paladin only at level 2", () => {
    expect(ids({ classId: "fighter", level: 1 })).toContain("class:fighter:fighting-style");
    expect(ids({ classId: "paladin", level: 1 })).not.toContain("class:paladin:fighting-style");
    expect(ids({ classId: "paladin", level: 2 })).toContain("class:paladin:fighting-style");
  });

  it("gives no style to a class that has none", () => {
    expect(ids({ classId: "wizard", level: 20 })).not.toContain("class:wizard:fighting-style");
  });
});

describe("a starting-equipment package asks nothing of its own", () => {
  // « Outils d'artisan au choix » in a package means the tool you are already
  // proficient with, so the package must not re-ask and produce a second field.
  it("offers a background's tool pick exactly once", () => {
    // The Soldier is the one SRD background whose package holds the tool it
    // let the player pick.
    for (const backgroundId of ["soldier"]) {
      const picks: ChoicePick[] = [
        { choiceId: `background:${backgroundId}:equipment`, values: ["a"] },
      ];
      // Only the background's own pick — a feat may legitimately add its own
      // tool choice from another source.
      const tools = resolveChoices({ backgroundId, picks }).filter(
        (def) => def.kind === "tool" && def.source === "background",
      );
      expect(
        tools.map((def) => def.id),
        backgroundId,
      ).toEqual([`background:${backgroundId}:tool`]);
    }
  });

  it("offers a class's tool pick exactly once — Barde and Moine", () => {
    for (const classId of ["bard", "monk"]) {
      const picks: ChoicePick[] = [{ choiceId: `class:${classId}:equipment`, values: ["a"] }];
      const tools = resolveChoices({ classId, level: 1, picks }).filter(
        (def) => def.kind === "tool" && def.source === "class",
      );
      expect(
        tools.map((def) => def.id),
        classId,
      ).toEqual([`class:${classId}:tool`]);
    }
  });

  it("opens a package's own pick — a gaming set carried without being mastered", () => {
    const veilleur = "brumes-du-nord:veilleur";
    const picks: ChoicePick[] = [{ choiceId: `background:${veilleur}:equipment`, values: ["a"] }];
    const ids = withContent(BRUMES, () =>
      resolveChoices({ backgroundId: veilleur, picks }).map((def) => def.id),
    );
    expect(ids).toContain(`background:${veilleur}:jeu`);
    expect(ids).not.toContain(`background:${veilleur}:tool`);
  });

  it("does not change what is open when the package is taken", () => {
    const base = { classId: "bard", level: 1 };
    const withoutKit = ids(base);
    const withKit = ids({
      ...base,
      picks: [{ choiceId: "class:bard:equipment", values: ["a"] }],
    });
    expect(withKit).toEqual(withoutKit);
  });
});

describe("feat choices", () => {
  it("brings in the origin feat's own picks — Sage grants Initié à la magie (magicien)", () => {
    const result = ids({ backgroundId: "sage" });
    expect(result).toContain("feat:magic-initiate-wizard:cantrips");
    expect(result).toContain("feat:magic-initiate-wizard:spell");
    expect(result).toContain("feat:magic-initiate-wizard:ability");
  });

  it("brings in Doué's three mixed proficiencies once picked as the origin feat", () => {
    const result = resolveChoices({
      backgroundId: "custom",
      picks: [{ choiceId: "background:custom:origin-feat", values: ["skilled"] }],
    });
    const skilled = result.find((def) => def.id === "feat:skilled:proficiencies");
    expect(skilled).toMatchObject({ kind: "proficiency", count: 3 });
  });

  it("adds nothing for an origin feat with no inner pick — Criminel grants Vigilant", () => {
    expect(ids({ backgroundId: "criminal" }).filter((id) => id.startsWith("feat:"))).toEqual([]);
  });
});

describe("heldFeatIds", () => {
  it("returns the background's origin feat", () => {
    expect(heldFeatIds({ backgroundId: "criminal" })).toEqual(["alert"]);
    expect(heldFeatIds({ backgroundId: "soldier" })).toEqual(["savage-attacker"]);
  });

  it("adds the fighting style once it is picked", () => {
    const picks: ChoicePick[] = [{ choiceId: "class:fighter:fighting-style", values: ["archery"] }];
    expect(heldFeatIds({ classId: "fighter", backgroundId: "soldier", level: 1, picks })).toEqual([
      "savage-attacker",
      "archery",
    ]);
  });

  it("ignores a style picked below the class's level", () => {
    const picks: ChoicePick[] = [{ choiceId: "class:paladin:fighting-style", values: ["defense"] }];
    expect(heldFeatIds({ classId: "paladin", level: 1, picks })).toEqual([]);
  });

  it("is empty with no background and no style", () => {
    expect(heldFeatIds({ classId: "wizard", level: 5 })).toEqual([]);
  });
});

describe("resolveChoicesFor", () => {
  it("narrows to one source — what a wizard step renders", () => {
    const speciesOnly = resolveChoicesFor(DRUID, "species");
    expect(speciesOnly.length).toBeGreaterThan(0);
    expect(speciesOnly.every((def) => def.source === "species")).toBe(true);
    expect(speciesOnly.map((def) => def.id)).toContain("species:elf:lineage");
  });

  it("offers a size pick only to the species that have one", () => {
    expect(resolveChoicesFor({ speciesId: "human" }, "species").map((d) => d.id)).toContain(
      "species:human:size",
    );
    expect(resolveChoicesFor({ speciesId: "elf" }, "species").map((d) => d.id)).not.toContain(
      "species:elf:size",
    );
  });
});

describe("level slots (amélioration ou don)", () => {
  it("opens nothing before level 4", () => {
    expect(ids({ ...DRUID, level: 3 }).filter((id) => id.startsWith("level:"))).toEqual([]);
  });

  it("opens one slot per improvement level reached", () => {
    expect(ids({ classId: "druid", level: 4 })).toContain("level:4:feat");
    expect(ids({ classId: "druid", level: 8 }).filter((id) => id.startsWith("level:"))).toEqual([
      "level:4:feat",
      "level:8:feat",
    ]);
  });

  it("gives the fighter its extra slots and the rogue its level-10 one", () => {
    const fighter = ids({ classId: "fighter", level: 6 }).filter((id) => id.startsWith("level:"));
    expect(fighter).toEqual(["level:4:feat", "level:6:feat"]);
    const rogue = ids({ classId: "rogue", level: 10 }).filter((id) => id.startsWith("level:"));
    expect(rogue).toEqual(["level:4:feat", "level:8:feat", "level:10:feat"]);
  });

  it("offers the general feats, « Amélioration de caractéristique » included", () => {
    const slot = resolveChoices({ classId: "druid", level: 4 }).find(
      (def) => def.id === "level:4:feat",
    );
    expect(slot).toMatchObject({ source: "level", kind: "option", count: 1 });
    const pool = slot?.pool as { kind: "list"; values: string[] };
    expect(pool.values).toContain("ability-score-improvement");
    expect(pool.values).toContain("grappler");
    expect(pool.values).not.toContain("archery"); // a fighting style, not a general feat
  });

  it("adds the epic boon slot at 19 only", () => {
    expect(ids({ classId: "druid", level: 18 })).not.toContain("level:19:epic-boon");
    const epic = resolveChoices({ classId: "druid", level: 19 }).find(
      (def) => def.id === "level:19:epic-boon",
    );
    expect(epic).toBeDefined();
    const epicPool = epic?.pool as { kind: "list"; values: string[] };
    expect(epicPool.values).toContain("boon-of-truesight");
  });

  it("counts a feat taken at a level slot as held", () => {
    const picks: ChoicePick[] = [{ choiceId: "level:4:feat", values: ["skill-expert"] }];
    expect(heldFeatIds({ classId: "druid", level: 4, picks })).toContain("skill-expert");
  });

  it("opens no level slot without a class — the levels are class-specific", () => {
    expect(
      ids({ backgroundId: "sage", level: 20 }).filter((id) => id.startsWith("level:")),
    ).toEqual([]);
  });
});

describe("feats held more than once", () => {
  const poolOf = (input: Parameters<typeof resolveChoices>[0], id: string) =>
    (resolveChoices(input).find((def) => def.id === id)?.pool as unknown as { values: string[] })
      .values;

  it("a feat that is not repeatable leaves the other lists once held", () => {
    // The soldier's origin feat is Sauvagerie martiale: the human cannot take it again.
    const human = poolOf(
      { speciesId: "human", backgroundId: "soldier" },
      "species:human:origin-feat",
    );
    expect(human).not.toContain("savage-attacker");
    expect(human).toContain("alert");
  });

  it("keeps a held feat in the list of the pick that holds it", () => {
    const picks: ChoicePick[] = [{ choiceId: "level:4:feat", values: ["grappler"] }];
    const input = { classId: "druid", level: 8, picks };
    expect(poolOf(input, "level:4:feat")).toContain("grappler");
    expect(poolOf(input, "level:8:feat")).not.toContain("grappler");
  });

  it("keeps offering a repeatable feat", () => {
    const picks: ChoicePick[] = [
      { choiceId: "level:4:feat", values: ["ability-score-improvement"] },
    ];
    expect(poolOf({ classId: "druid", level: 8, picks }, "level:8:feat")).toContain(
      "ability-score-improvement",
    );
  });

  it("gives a repeatable feat taken twice its own picks the second time", () => {
    const picks: ChoicePick[] = [
      { choiceId: "background:custom:origin-feat", values: ["skilled"] },
      { choiceId: "species:human:origin-feat", values: ["skilled"] },
    ];
    const opened = ids({ speciesId: "human", backgroundId: "custom", picks });
    expect(opened).toContain("feat:skilled:proficiencies");
    expect(opened).toContain("feat:skilled:proficiencies#2");
  });

  it("takes Initié à la magie again only on another list", () => {
    // The acolyte's origin feat is Initié à la magie (clerc).
    const human = poolOf(
      { speciesId: "human", backgroundId: "acolyte" },
      "species:human:origin-feat",
    );
    expect(human).not.toContain("magic-initiate-cleric");
    expect(human).toContain("magic-initiate-wizard");
  });

  it("opens an origin feat for each « Enseignement des Premiers-Nés »", () => {
    const once = { classId: "warlock", level: 2, invocations: ["lessons-of-the-first-ones"] };
    expect(ids(once)).toContain("invocation:lessons-of-the-first-ones:feat");
    const twice = {
      ...once,
      invocations: ["lessons-of-the-first-ones", "lessons-of-the-first-ones"],
    };
    expect(ids(twice)).toContain("invocation:lessons-of-the-first-ones:feat#2");
    const picks: ChoicePick[] = [
      { choiceId: "invocation:lessons-of-the-first-ones:feat", values: ["alert"] },
    ];
    expect(heldFeatIds({ ...once, picks })).toContain("alert");
  });

  it("opens nothing for the invocation without a warlock", () => {
    expect(
      ids({ classId: "wizard", level: 2, invocations: ["lessons-of-the-first-ones"] }),
    ).not.toContain("invocation:lessons-of-the-first-ones:feat");
  });
});

describe("ability-score improvement", () => {
  const WIZARD4 = { classId: "wizard", speciesId: "elf", backgroundId: "sage", level: 4 };
  const asiPick = (values: string[]): ChoicePick[] => [
    { choiceId: "level:4:feat", values: ["ability-score-improvement"] },
    { choiceId: "level:4:asi", values },
  ];

  it("asks which abilities go up only once the improvement is the feat taken", () => {
    expect(ids(WIZARD4)).not.toContain("level:4:asi");
    expect(
      ids({ ...WIZARD4, picks: [{ choiceId: "level:4:feat", values: ["grappler"] }] }),
    ).not.toContain("level:4:asi");
    expect(ids({ ...WIZARD4, picks: asiPick([]) })).toContain("level:4:asi");
  });

  it("accepts the same ability twice, for +2", () => {
    const picks = asiPick(["int", "int"]);
    const defs = resolveChoices({ ...WIZARD4, picks });
    const asi = defs.filter((def) => def.id === "level:4:asi");
    expect(validateChoices(asi, picks, 4)).toEqual([]);
    expect(
      pruneChoicePicks(defs, picks, 4).find((pick) => pick.choiceId === "level:4:asi")?.values,
    ).toEqual(["int", "int"]);
    expect(abilityScoreImprovements({ ...WIZARD4, picks })).toEqual({ int: 2 });
  });

  it("asks where a feat's +1 goes, among the feat's own options", () => {
    const defs = resolveChoices({
      ...WIZARD4,
      picks: [{ choiceId: "level:4:feat", values: ["grappler"] }],
    });
    const increase = defs.find((def) => def.id === "feat:grappler:ability-increase");
    expect(increase).toMatchObject({
      kind: "ability",
      count: 1,
      via: "level",
      pool: { kind: "list", values: ["str", "dex"] },
    });
  });

  it("counts nothing below the level, or when another feat is taken", () => {
    expect(
      abilityScoreImprovements({ ...WIZARD4, level: 3, picks: asiPick(["int", "con"]) }),
    ).toEqual({});
    expect(
      abilityScoreImprovements({
        ...WIZARD4,
        picks: [
          { choiceId: "level:4:feat", values: ["grappler"] },
          { choiceId: "level:4:asi", values: ["int", "con"] },
        ],
      }),
    ).toEqual({});
  });
});

describe("subclass spell lists", () => {
  it("asks a Circle of the Land druid for an environment, once the circle is taken", () => {
    const input = { classId: "druid", level: 3 };
    expect(ids(input)).not.toContain("class:druid:subclass-spells");
    const defs = resolveChoices({
      ...input,
      picks: [{ choiceId: "class:druid:subclass", values: ["druid:cercle-de-la-terre"] }],
    });
    expect(defs.find((def) => def.id === "class:druid:subclass-spells")?.pool).toEqual({
      kind: "list",
      values: ["Aride", "Polaire", "Tempéré", "Tropical"],
    });
  });

  it("asks nothing of a subclass with a single list", () => {
    const defs = resolveChoices({
      classId: "cleric",
      level: 3,
      picks: [{ choiceId: "class:cleric:subclass", values: ["cleric:domaine-de-la-vie"] }],
    });
    expect(defs.map((def) => def.id)).not.toContain("class:cleric:subclass-spells");
  });
});

describe("a skill granted twice", () => {
  const swapId = "background:criminal:skill-swap";
  const criminalRogue = (skills: string[], extra: ChoicePick[] = []) =>
    resolveChoices({
      classId: "rogue",
      backgroundId: "criminal",
      picks: [{ choiceId: "class:rogue:skills", values: skills }, ...extra],
    });

  it("opens a replacement when the background repeats a class skill", () => {
    expect(criminalRogue(["perception", "acrobatics"]).some((def) => def.id === swapId)).toBe(
      false,
    );
    const swap = criminalRogue(["stealth", "perception"]).find((def) => def.id === swapId)!;
    expect(swap).toMatchObject({ source: "background", kind: "skill", count: 1 });
    // It says which skill is taken twice, and where it came from first.
    expect(swap.hint).toContain("Discrétion (grâce à Roublard)");
    // Nothing the character already masters is offered.
    const pool = swap.pool.kind === "list" ? swap.pool.values : [];
    expect(pool).toContain("medicine");
    for (const skill of ["stealth", "perception", "sleightOfHand"])
      expect(pool).not.toContain(skill);
  });

  it("keeps the replacement while it is picked, and drops it with the duplicate", () => {
    const picked: ChoicePick[] = [{ choiceId: swapId, values: ["medicine"] }];
    expect(criminalRogue(["stealth", "perception"], picked).some((def) => def.id === swapId)).toBe(
      true,
    );
    const defs = criminalRogue(["acrobatics", "perception"], picked);
    expect(pruneChoicePicks(defs, picked, 1)).toEqual([]);
  });
});

describe("a feat's own picks", () => {
  it("come right after the choice that picked the feat", () => {
    const ids = resolveChoices({
      speciesId: "human",
      backgroundId: "sage",
      picks: [{ choiceId: "species:human:origin-feat", values: ["skilled"] }],
    }).map((def) => def.id);
    expect(ids.indexOf("feat:skilled:proficiencies")).toBe(
      ids.indexOf("species:human:origin-feat") + 1,
    );
  });
});
