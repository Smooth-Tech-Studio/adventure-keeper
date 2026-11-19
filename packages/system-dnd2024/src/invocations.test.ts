import { describe, expect, it } from "vitest";
import {
  INVOCATIONS,
  getInvocation,
  invocationAvailable,
  invocationCombatNotes,
  invocationEffects,
  invocationRollSources,
  validInvocations,
} from "./invocations";
import { invocationsKnown } from "./classes";

describe("invocationsKnown", () => {
  it("follows the Warlock class table", () => {
    const table = [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10];
    table.forEach((known, index) => {
      expect(invocationsKnown("warlock", index + 1)).toBe(known);
    });
  });

  it("is zero for every other class and clamps the level", () => {
    expect(invocationsKnown("wizard", 20)).toBe(0);
    expect(invocationsKnown("warlock", 0)).toBe(1);
    expect(invocationsKnown("warlock", 99)).toBe(10);
  });
});

describe("invocation catalogue", () => {
  it("has the 28 invocations, unique ids, sorted by French name", () => {
    expect(INVOCATIONS).toHaveLength(28);
    expect(new Set(INVOCATIONS.map((i) => i.id)).size).toBe(28);
    const names = INVOCATIONS.map((i) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "fr")));
  });

  it("only requires invocations that exist", () => {
    for (const invocation of INVOCATIONS) {
      if (invocation.requires) expect(getInvocation(invocation.requires)).toBeDefined();
    }
  });
});

describe("invocationAvailable", () => {
  const smite = getInvocation("eldritch-smite")!;

  it("needs the level and the required Pact", () => {
    expect(invocationAvailable(smite, 4, ["pact-of-the-blade"])).toBe(false);
    expect(invocationAvailable(smite, 5, [])).toBe(false);
    expect(invocationAvailable(smite, 5, ["pact-of-the-blade"])).toBe(true);
  });

  it("accepts an invocation with no prerequisite at any level", () => {
    expect(invocationAvailable(getInvocation("armor-of-shadows")!, 1, [])).toBe(true);
  });
});

describe("validInvocations", () => {
  const ids = (picks: ReturnType<typeof validInvocations>) => picks.map((pick) => pick.id);

  it("drops unknown ids and duplicates", () => {
    expect(ids(validInvocations(["armor-of-shadows", "nope", "armor-of-shadows"], 1))).toEqual([
      "armor-of-shadows",
    ]);
  });

  it("reads the plain ids of sheets saved before picks carried a cantrip", () => {
    expect(validInvocations(["armor-of-shadows"], 1)).toEqual([{ id: "armor-of-shadows" }]);
  });

  it("drops what the level no longer allows", () => {
    expect(ids(validInvocations(["armor-of-shadows", "devils-sight"], 1))).toEqual([
      "armor-of-shadows",
    ]);
  });

  it("drops dependants when their Pact is gone, transitively", () => {
    const chain = ["thirsting-blade", "devouring-blade"];
    expect(validInvocations(chain, 12)).toEqual([]);
    expect(ids(validInvocations(["pact-of-the-blade", ...chain], 12))).toEqual([
      "pact-of-the-blade",
      ...chain,
    ]);
  });

  it("needs a cantrip for Décharge déchirante and keeps it", () => {
    expect(validInvocations([{ id: "agonizing-blast" }], 2)).toEqual([]);
    expect(validInvocations([{ id: "agonizing-blast", spellId: "eldritch-blast" }], 2)).toEqual([
      { id: "agonizing-blast", spellId: "eldritch-blast" },
    ]);
  });

  it("allows a repeatable invocation on another cantrip, not on the same one", () => {
    const picks = [
      { id: "agonizing-blast", spellId: "eldritch-blast" },
      { id: "agonizing-blast", spellId: "chill-touch" },
      { id: "agonizing-blast", spellId: "eldritch-blast" },
    ];
    expect(validInvocations(picks, 2).map((pick) => pick.spellId)).toEqual([
      "eldritch-blast",
      "chill-touch",
    ]);
  });

  it("drops a cantrip pick whose cantrip is no longer known", () => {
    const picks = [{ id: "agonizing-blast", spellId: "chill-touch" }];
    expect(validInvocations(picks, 2, ["eldritch-blast"])).toEqual([]);
    expect(validInvocations(picks, 2, ["chill-touch"])).toHaveLength(1);
  });

  it("strips a stray cantrip from an invocation that takes none", () => {
    expect(validInvocations([{ id: "armor-of-shadows", spellId: "fire-bolt" }], 1)).toEqual([
      { id: "armor-of-shadows" },
    ]);
  });
});

describe("invocationEffects", () => {
  it("collects AC, senses, swimming and the pact flags", () => {
    const picks = validInvocations(
      [
        "armor-of-shadows",
        "devils-sight",
        "witch-sight",
        "gift-of-the-depths",
        "pact-of-the-blade",
        "lifedrinker",
      ],
      15,
    );
    expect(invocationEffects(picks)).toEqual({
      unarmoredAc: 13,
      darkvision: 120,
      truesight: 30,
      swimSpeed: true,
      pactBlade: true,
      lifedrinker: true,
    });
  });

  it("is neutral without invocations", () => {
    expect(invocationEffects([])).toEqual({
      unarmoredAc: null,
      darkvision: 0,
      truesight: 0,
      swimSpeed: false,
      pactBlade: false,
      lifedrinker: false,
    });
  });
});

describe("invocationCombatNotes", () => {
  const notes = (ids: string[], extra?: Partial<Parameters<typeof invocationCombatNotes>[0]>) =>
    invocationCombatNotes({
      picks: validInvocations(ids, 12),
      level: 12,
      chaMod: 3,
      hasPactWeapon: true,
      ...extra,
    });

  it("gives Lame assoiffée two attacks and Lame dévorante three", () => {
    const base = ["pact-of-the-blade", "thirsting-blade"];
    expect(notes(base).join(" ")).toContain("attaquez 2 fois");
    expect(notes([...base, "devouring-blade"]).join(" ")).toContain("attaquez 3 fois");
  });

  it("computes Frappe occulte's dice from the pact slot level", () => {
    const text = notes(["pact-of-the-blade", "eldritch-smite"], { pactSlotLevel: 5 }).join(" ");
    expect(text).toContain("niv 5");
    expect(text).toContain("6d8");
  });

  it("asks for a pact weapon when none is designated", () => {
    expect(notes(["pact-of-the-blade"], { hasPactWeapon: false })[0]).toContain("désignez");
    // The Charisma is counted in the attack line: what is left to remember is the damage type.
    expect(notes(["pact-of-the-blade"])[0]).toContain("au choix");
    expect(notes(["pact-of-the-blade"])[0]).not.toContain("Charisme");
  });

  it("scales Lance occulte's range with the level", () => {
    expect(notes([{ id: "eldritch-spear", spellId: "eldritch-blast" }] as never)).toEqual([
      expect.stringContaining("108 m"),
    ]);
  });

  it("says nothing for invocations covered elsewhere", () => {
    expect(notes(["devils-sight", "mask-of-many-faces"])).toEqual([]);
  });
});

describe("invocationRollSources", () => {
  const picks = validInvocations(
    [
      { id: "agonizing-blast", spellId: "eldritch-blast" },
      { id: "agonizing-blast", spellId: "chill-touch" },
      "pact-of-the-blade",
      "lifedrinker",
      "eldritch-mind",
    ].map((p) => (typeof p === "string" ? { id: p } : p)),
    9,
  );
  const sources = (roll: Parameters<typeof invocationRollSources>[0]["roll"]) =>
    invocationRollSources({ picks, chaMod: 4, pactWeaponId: "sword", roll });

  it("adds Charisma to the chosen cantrip's damage, once per Décharge occulte beam", () => {
    expect(sources({ kind: "damage", spellId: "chill-touch", damageDiceCount: 2 })).toEqual([
      { label: "Décharge déchirante", flat: 4 },
    ]);
    expect(sources({ kind: "damage", spellId: "eldritch-blast", damageDiceCount: 3 })).toEqual([
      { label: "Décharge déchirante", flat: 12 },
    ]);
  });

  it("adds nothing to a cantrip it is not attached to", () => {
    expect(sources({ kind: "damage", spellId: "fire-bolt" })).toEqual([]);
  });

  it("adds 1d6 to the pact weapon's damage only", () => {
    expect(sources({ kind: "damage", weaponId: "sword" })).toEqual([
      { label: "Buveuse de vie", dice: { count: 1, die: "d6" } },
    ]);
    expect(sources({ kind: "damage", weaponId: "dagger" })).toEqual([]);
  });

  it("flags advantage on a Constitution save to keep concentration", () => {
    expect(sources({ kind: "save", ability: "con", concentrating: true })).toEqual([
      { label: "Esprit occulte", hint: "avantage (concentration)" },
    ]);
    expect(sources({ kind: "save", ability: "con", concentrating: false })).toEqual([]);
    expect(sources({ kind: "save", ability: "wis", concentrating: true })).toEqual([]);
  });
});
