import { useEffect, useState } from "react";
import {
  Dice5Icon,
  HeartHandshakeIcon,
  PawPrintIcon,
  PlusIcon,
  SwordsIcon,
  Trash2Icon,
} from "lucide-react";
import {
  type AdventureEnemy,
  type AdventureNpc,
  type AdventureParticipant,
  type Companion,
  type ReadyCharacter,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EnemyFormDialog } from "@/components/adventure/enemy-form-dialog";
import { emptyEnemyForm, type EnemyFormValues } from "@/components/adventure/enemy-form";
import type { LocationOption } from "@/components/adventure/location-link-select";
import { d20 } from "@/lib/dice";
import { Label } from "@/components/ui/label";
import type { WithId } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { systemOf } from "@/systems";

/**
 * Initiative bonus from a character — 5e: Dexterity plus what the features add
 * (Vigilant…), Dexterity alone on a sheet derived before them; else 0.
 */
const initiativeBonus = (character: ReadyCharacter | undefined): number =>
  character ? systemOf(character).combatStats(character).initiativeBonus : 0;

export interface CombatSetupResult {
  participants: { participant: WithId<AdventureParticipant>; initiative: number }[];
  /** The characters' familiars — each rolls its own initiative. */
  companions: {
    participant: WithId<AdventureParticipant>;
    companion: Companion;
    initiative: number;
  }[];
  /**
   * One entry per enemy instance — each rolls its own initiative. An `ally`
   * fights on the party's side (an allied NPC), in its own `color`.
   */
  enemies: {
    enemy: WithId<AdventureEnemy>;
    label: string;
    initiative: number;
    ally?: boolean;
    color?: string;
  }[];
}

interface Props {
  trigger: React.ReactNode;
  participants: WithId<AdventureParticipant>[];
  charactersById: Record<string, WithId<ReadyCharacter>>;
  enemies: WithId<AdventureEnemy>[];
  /** The adventure's NPCs: those with a combat profile can join as allies. */
  npcs?: WithId<AdventureNpc>[];
  onCreate: (result: CombatSetupResult) => void;
  /** Persist a brand-new enemy type to the adventure and return it. */
  onCreateEnemy?: (values: EnemyFormValues) => Promise<WithId<AdventureEnemy>>;
  locationOptions?: LocationOption[];
  /** `add` = reinforcements into a running combat: enemies only, no participant rows. */
  mode?: "create" | "add";
  /** Names already in the fight: reinforcements number on from them (« Gobelin 2 »). */
  takenNames?: string[];
}

interface ParticipantRow {
  on: boolean;
  init: string;
  /** The total the player rolled from their sheet. */
  byPlayer?: boolean;
  /** Typed or re-rolled by the GM: a player's roll no longer overwrites it. */
  edited?: boolean;
}

interface EnemyInstance {
  key: string;
  enemyId: string;
  label: string;
  init: string;
  ally: boolean;
  /** An NPC's own token colour. */
  color?: string;
}

let instanceCounter = 0;
const nextKey = () => `ei${(instanceCounter += 1)}`;

export function CombatSetupDialog({
  trigger,
  participants,
  charactersById,
  enemies,
  npcs = [],
  onCreate,
  onCreateEnemy,
  locationOptions = [],
  mode = "create",
  takenNames = [],
}: Props) {
  const adding = mode === "add";
  const { t } = useTranslation("session", { keyPrefix: "setup" });
  const [open, setOpen] = useState(false);
  const [pRows, setPRows] = useState<Record<string, ParticipantRow>>({});
  const [instances, setInstances] = useState<EnemyInstance[]>([]);
  /** Enemy types created from this dialog before the parent list catches up. */
  const [extraEnemies, setExtraEnemies] = useState<WithId<AdventureEnemy>[]>([]);
  const [creatingEnemy, setCreatingEnemy] = useState(false);
  // Stable blank form while the "create enemy" dialog is open (a fresh literal
  // every render would reset EnemyFormDialog on each keystroke).
  const [blankEnemyForm, setBlankEnemyForm] = useState(emptyEnemyForm);
  useEffect(() => {
    if (creatingEnemy) setBlankEnemyForm(emptyEnemyForm());
  }, [creatingEnemy]);

  const allEnemies = [...enemies, ...extraEnemies];
  // Familiars follow their character into the fight, each with its own initiative.
  const companions = participants.flatMap((participant) => {
    const character = charactersById[participant.characterId];
    return character
      ? systemOf(character)
          .companions(character)
          .map((companion) => ({
            participant,
            companion,
            key: `${participant.id}:${companion.id}`,
          }))
      : [];
  });
  const [cRows, setCRows] = useState<Record<string, { on: boolean; init: string }>>({});

  // Opening the dialog rolls for each character — unless its player already
  // rolled from their sheet. Only on opening: a later snapshot (HP, a roll
  // coming in) must not re-roll what the GM is looking at.
  useEffect(() => {
    if (!open) return;
    setPRows(
      Object.fromEntries(
        participants.map((p) => {
          const rolled = p.initiativeRoll;
          const dex = initiativeBonus(charactersById[p.characterId]);
          return [
            p.id,
            rolled != null
              ? { on: true, init: String(rolled), byPlayer: true }
              : { on: true, init: String(d20() + dex) },
          ];
        }),
      ),
    );
    setCRows(
      Object.fromEntries(
        companions.map(({ key, companion }) => [
          key,
          { on: true, init: String(d20() + companion.dexModifier) },
        ]),
      ),
    );
    setInstances([]);
    setExtraEnemies([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on opening only, see above
  }, [open]);

  // A player rolls while the dialog is open: their total replaces the app's
  // roll, unless the GM typed one by hand.
  const playerRolls = participants.map((p) => `${p.id}=${p.initiativeRoll ?? ""}`).join(",");
  useEffect(() => {
    if (!open) return;
    setPRows((rows) => {
      let changed = false;
      const next = { ...rows };
      for (const p of participants) {
        const row = rows[p.id];
        if (!row || row.edited || p.initiativeRoll == null) continue;
        if (row.byPlayer && row.init === String(p.initiativeRoll)) continue;
        next[p.id] = { ...row, init: String(p.initiativeRoll), byPlayer: true };
        changed = true;
      }
      return changed ? next : rows;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the rolls themselves
  }, [open, playerRolls]);

  function addInstance(enemy: WithId<AdventureEnemy>) {
    setInstances((cur) => {
      // The first free number, counting those already in the fight.
      const taken = new Set([...takenNames, ...cur.map((i) => i.label)]);
      let n = 1;
      while (taken.has(`${enemy.name} ${n}`)) n += 1;
      return [
        ...cur,
        {
          key: nextKey(),
          enemyId: enemy.id,
          label: `${enemy.name} ${n}`,
          init: String(d20()),
          ally: false,
        },
      ];
    });
  }

  /** An NPC fights under its own name and colour, on the party's side. */
  function addNpc(npc: WithId<AdventureNpc>, enemy: WithId<AdventureEnemy>) {
    setInstances((cur) => [
      ...cur,
      {
        key: nextKey(),
        enemyId: enemy.id,
        label: npc.name,
        init: String(d20()),
        ally: true,
        color: npc.color,
      },
    ]);
  }
  const fightingNpcs = npcs.flatMap((npc) => {
    const enemy = allEnemies.find((e) => e.id === npc.enemyId);
    return enemy ? [{ npc, enemy }] : [];
  });

  async function createAndAddEnemy(values: EnemyFormValues) {
    if (!onCreateEnemy) return;
    const created = await onCreateEnemy(values);
    setExtraEnemies((cur) => [...cur, created]);
    addInstance(created);
    setCreatingEnemy(false);
  }

  function patchInstance(key: string, patch: Partial<EnemyInstance>) {
    setInstances((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function submit() {
    const result: CombatSetupResult = {
      participants: participants
        .filter((p) => pRows[p.id]?.on)
        .map((p) => ({ participant: p, initiative: Number(pRows[p.id]?.init) || 0 })),
      // A familiar goes in with its character.
      companions: companions
        .filter(({ key, participant }) => cRows[key]?.on && pRows[participant.id]?.on)
        .map(({ key, participant, companion }) => ({
          participant,
          companion,
          initiative: Number(cRows[key]?.init) || 0,
        })),
      enemies: instances.flatMap((inst) => {
        const enemy = allEnemies.find((e) => e.id === inst.enemyId);
        return enemy
          ? [
              {
                enemy,
                label: inst.label.trim() || enemy.name,
                initiative: Number(inst.init) || 0,
                ally: inst.ally,
                ...(inst.color ? { color: inst.color } : {}),
              },
            ]
          : [];
      }),
    };
    if (result.participants.length + result.companions.length + result.enemies.length === 0) return;
    onCreate(result);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{adding ? t("addTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{adding ? t("addIntro") : t("createIntro")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!adding && (
            <div className="grid gap-1">
              <Label className="text-xs">{t("characters")}</Label>
              {participants.length === 0 && (
                <p className="text-muted-foreground text-sm">{t("noCharacter")}</p>
              )}
              {participants.map((p) => {
                const row = pRows[p.id] ?? { on: true, init: "10" };
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={row.on}
                      onCheckedChange={(c) =>
                        setPRows((r) => ({ ...r, [p.id]: { ...row, on: c === true } }))
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.characterName}
                      {row.byPlayer && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          {t("rolledByPlayer")}
                        </span>
                      )}
                    </span>
                    <Input
                      type="number"
                      aria-label={t("initiativeOf", { name: p.characterName })}
                      className="h-8 w-16 text-center"
                      value={row.init}
                      onChange={(e) =>
                        setPRows((r) => ({
                          ...r,
                          [p.id]: { ...row, init: e.target.value, byPlayer: false, edited: true },
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={t("reroll")}
                      onClick={() => {
                        const dex = initiativeBonus(charactersById[p.characterId]);
                        setPRows((r) => ({
                          ...r,
                          [p.id]: {
                            ...row,
                            init: String(d20() + dex),
                            byPlayer: false,
                            edited: true,
                          },
                        }));
                      }}
                    >
                      <Dice5Icon className="size-4" />
                    </Button>
                  </div>
                );
              })}
              {companions.map(({ key, participant, companion }) => {
                const row = cRows[key] ?? { on: true, init: "10" };
                return (
                  <div key={key} className="flex items-center gap-2 pl-5">
                    <Checkbox
                      checked={row.on}
                      aria-label={t("companionOf", {
                        name: companion.name,
                        owner: participant.characterName,
                      })}
                      onCheckedChange={(c) =>
                        setCRows((r) => ({ ...r, [key]: { ...row, on: c === true } }))
                      }
                    />
                    <PawPrintIcon className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {companion.name}
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        {t("familiarOf", { owner: participant.characterName })}
                      </span>
                    </span>
                    <Input
                      type="number"
                      aria-label={t("initiativeOf", { name: companion.name })}
                      className="h-8 w-16 text-center"
                      value={row.init}
                      onChange={(e) =>
                        setCRows((r) => ({ ...r, [key]: { ...row, init: e.target.value } }))
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={t("reroll")}
                      onClick={() =>
                        setCRows((r) => ({
                          ...r,
                          [key]: { ...row, init: String(d20() + companion.dexModifier) },
                        }))
                      }
                    >
                      <Dice5Icon className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">{t("enemies")}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="h-7">
                    <PlusIcon className="size-3.5" /> {t("addEnemy")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
                  {allEnemies.map((enemy) => (
                    <DropdownMenuItem key={enemy.id} onSelect={() => addInstance(enemy)}>
                      {enemy.name}
                      <span className="text-muted-foreground ml-auto text-xs">
                        {t("hp", { value: enemy.maxHitPoints })}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {allEnemies.length === 0 && (
                    <DropdownMenuItem disabled>{t("noEnemyType")}</DropdownMenuItem>
                  )}
                  {fightingNpcs.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs">{t("alliedNpcs")}</DropdownMenuLabel>
                      {fightingNpcs.map(({ npc, enemy }) => (
                        <DropdownMenuItem key={npc.id} onSelect={() => addNpc(npc, enemy)}>
                          <HeartHandshakeIcon className="size-3.5" /> {npc.name}
                          <span className="text-muted-foreground ml-auto text-xs">
                            {t("hp", { value: enemy.maxHitPoints })}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  {onCreateEnemy && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setCreatingEnemy(true)}>
                        <PlusIcon className="size-3.5" /> {t("createEnemy")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {instances.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {adding ? t("noneSelected") : t("noneInCombat")}
              </p>
            )}
            {instances.map((inst) => (
              <div key={inst.key} className="flex items-center gap-2">
                <Input
                  aria-label={t("instanceName")}
                  className="h-8 flex-1"
                  value={inst.label}
                  onChange={(e) => patchInstance(inst.key, { label: e.target.value })}
                />
                <Input
                  type="number"
                  aria-label={t("initiative")}
                  className="h-8 w-16 text-center"
                  value={inst.init}
                  onChange={(e) => patchInstance(inst.key, { init: e.target.value })}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={t("reroll")}
                  onClick={() => patchInstance(inst.key, { init: String(d20()) })}
                >
                  <Dice5Icon className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-pressed={inst.ally}
                  className={cn(
                    "size-8",
                    inst.ally && "bg-teal-600/15 text-teal-700 dark:text-teal-300",
                  )}
                  aria-label={t("ally", { name: inst.label })}
                  title={inst.ally ? t("allyOn") : t("allyOff")}
                  onClick={() => patchInstance(inst.key, { ally: !inst.ally })}
                >
                  <HeartHandshakeIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8"
                  aria-label={t("remove")}
                  onClick={() => setInstances((cur) => cur.filter((i) => i.key !== inst.key))}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {onCreateEnemy && (
          <EnemyFormDialog
            open={creatingEnemy}
            onOpenChange={setCreatingEnemy}
            initial={blankEnemyForm}
            locationOptions={locationOptions}
            onSave={createAndAddEnemy}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit}>
            <SwordsIcon /> {adding ? t("addToCombat") : t("launch")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
