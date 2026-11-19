/**
 * Keeps `save` / `attackRoll` on `packages/system-dnd2024/src/srd/spells.json` in sync with a
 * committed reference of the 5e 2024 rules.
 *
 *   pnpm tsx scripts/annotate-spell-resolution.ts            # --check (default)
 *   pnpm tsx scripts/annotate-spell-resolution.ts --write    # apply + prettier
 *
 * `scripts/data/spell-resolution-2024.json` is the source of truth: `save` /
 * `attackRoll` per spell id, transcribed from aidedd.org's 5e 2024 spell list
 * (English list — its slugs match our ids) and cross-checked spell-by-spell in
 * September 2026. `OVERRIDES` below records the few deliberate deviations. The
 * reference also carries an advisory `damage` string (aidedd's base dice) that
 * `--check` diffs against ours but never writes — our blocks keep the
 * `scaling` / `step` / `note` nuances a plain string can't.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
type SaveOutcome = "negates" | "half" | "partial";
interface Save {
  ability: Ability;
  onSuccess: SaveOutcome;
}
interface Resolution {
  save?: Save;
  attackRoll?: boolean;
}
interface Spell extends Resolution {
  id: string;
  damage?: { pool?: { count: number; die: string }; kind?: string } | null;
  [k: string]: unknown;
}

const SPELLS_FILE = fileURLToPath(
  new URL("../packages/system-dnd2024/src/srd/spells.json", import.meta.url),
);
const REF_FILE = fileURLToPath(new URL("./data/spell-resolution-2024.json", import.meta.url));

type RefEntry = { save?: Save; attackRoll?: true; damage?: string };
const REFERENCE = JSON.parse(readFileSync(REF_FILE, "utf8")) as Record<string, RefEntry>;

/**
 * Deliberate deviations from the reference. `save: null` / `attackRoll: null`
 * drop a field the reference would set. A `damage` block is merged in when the
 * spell has none, so a `half`-on-success save has dice to halve.
 */
const OVERRIDES: Record<
  string,
  Resolution & { save?: Save | null; attackRoll?: true | null } & {
    damage?: Spell["damage"];
  }
> = {
  // A d20 roll to hit, just not the literal "spell attack" the reference scans for.
  "true-strike": { attackRoll: true },
  // Damage is automatic; the Con save only prevents dropping the object.
  "heat-metal": { save: { ability: "con", onSuccess: "partial" } },
  // Damage type is chosen at cast time, so there is no single `kind` to record;
  // keep it out of the damage table and mark the Dex-for-half save "partial".
  "dragons-breath": { save: { ability: "dex", onSuccess: "partial" } },
  // The damage rune is one option among many and its dice are configurable.
  "glyph-of-warding": { save: { ability: "dex", onSuccess: "partial" } },
  // half-on-success saves whose damage dice were missing from our data.
  "flaming-sphere": {
    damage: { pool: { count: 2, die: "d6" }, kind: "fire", scaling: "slot" },
  } as never,
  "wind-wall": { damage: { pool: { count: 4, die: "d8" }, kind: "bludgeoning" } } as never,
};

const KEY_ORDER = [
  "id",
  "name",
  "level",
  "school",
  "classes",
  "castingTime",
  "range",
  "components",
  "duration",
  "concentration",
  "ritual",
  "summary",
  "damage",
  "save",
  "attackRoll",
];

function reorder(spell: Spell): void {
  const copy: Record<string, unknown> = {};
  for (const key of KEY_ORDER) if (key in spell) copy[key] = spell[key];
  for (const key of Object.keys(spell)) if (!(key in copy)) copy[key] = spell[key];
  for (const key of Object.keys(spell)) delete spell[key];
  Object.assign(spell, copy);
}

/** The resolution a spell *should* have: reference, then OVERRIDES on top. */
function wanted(id: string): Resolution {
  const ref = REFERENCE[id] ?? {};
  const res: Resolution = {};
  if (ref.attackRoll) res.attackRoll = true;
  if (ref.save) res.save = ref.save;
  const ov = OVERRIDES[id];
  if (ov) {
    if ("attackRoll" in ov) res.attackRoll = ov.attackRoll ?? undefined;
    if ("save" in ov) res.save = ov.save ?? undefined;
  }
  return res;
}

const eq = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const diceStr = (d: Spell["damage"]) =>
  d?.pool ? `${d.pool.count}${d.pool.die} ${d.kind ?? ""}`.trim() : null;

/**
 * Spells whose damage block deliberately differs from aidedd's headline dice —
 * `--check` won't nag about these. None since the non-SRD spells left the code.
 */
const DAMAGE_DIVERGENCE_OK = new Set<string>();

// The SRD kind file: the spells, and their English apart.
const file = JSON.parse(readFileSync(SPELLS_FILE, "utf8")) as { entries: Spell[] };
const spells = file.entries;
const write = process.argv.includes("--write");

const resMismatch: string[] = [];
const dmgReview: string[] = [];

for (const spell of spells) {
  const want = wanted(spell.id);
  if (!eq(spell.save, want.save) || Boolean(spell.attackRoll) !== Boolean(want.attackRoll)) {
    resMismatch.push(
      `  ${spell.id.padEnd(26)} ours ${JSON.stringify({ save: spell.save ?? null, attackRoll: !!spell.attackRoll })}` +
        `  →  ${JSON.stringify({ save: want.save ?? null, attackRoll: !!want.attackRoll })}`,
    );
  }
  const refDmg = REFERENCE[spell.id]?.damage;
  if (refDmg && !DAMAGE_DIVERGENCE_OK.has(spell.id) && diceStr(spell.damage) !== refDmg) {
    dmgReview.push(
      `  ${spell.id.padEnd(26)} ours ${diceStr(spell.damage) ?? "—"}  vs aidedd ${refDmg}`,
    );
  }
}

if (!write) {
  console.log(
    resMismatch.length
      ? `save / attackRoll — ${resMismatch.length} écart(s) vs la référence :\n${resMismatch.join("\n")}`
      : "save / attackRoll : conforme à la référence ✔",
  );
  if (dmgReview.length) {
    console.log(
      `\ndés de dégâts — ${dmgReview.length} à revoir (référence = base aidedd, indicative) :\n${dmgReview.join("\n")}`,
    );
  }
  process.exit(resMismatch.length ? 1 : 0);
}

for (const spell of spells) {
  const want = wanted(spell.id);
  delete spell.save;
  delete spell.attackRoll;
  if (want.attackRoll) spell.attackRoll = true;
  if (want.save) spell.save = want.save;
  const ovDmg = OVERRIDES[spell.id]?.damage;
  if (ovDmg && spell.damage == null) spell.damage = ovDmg;
  reorder(spell);
}

writeFileSync(SPELLS_FILE, JSON.stringify(file, null, 2) + "\n");
execFileSync("pnpm", ["exec", "prettier", "--write", SPELLS_FILE], { stdio: "inherit" });
console.log(
  `Écrit + prettier. ${spells.filter((s) => s.save).length} save, ${spells.filter((s) => s.attackRoll).length} attackRoll.`,
);
