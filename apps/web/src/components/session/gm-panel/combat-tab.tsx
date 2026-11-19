import { useState } from "react";
import {
  MapPinIcon,
  MapPinOffIcon,
  MoreVerticalIcon,
  PlusIcon,
  SkipForwardIcon,
  SwordsIcon,
  Trash2Icon,
} from "lucide-react";
import type {
  AdventureEnemy,
  AdventureNpc,
  AdventureParticipant,
  LiveSession,
  ReadyCharacter,
  SessionCombatant,
} from "@adventure-keeper/schemas";
import { CONDITION_LABELS } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationOption } from "@/components/adventure/location-link-select";
import { CombatSetupDialog } from "@/components/session/combat-setup-dialog";
import { DiceRollerBlock } from "@/components/session/dice-roller-block";
import { EnemyAttacks, EnemyPanel } from "@/components/session/enemy-panel";
import { HpPadDialog } from "@/components/session/hp-pad-dialog";
import { HpStepper } from "@/systems/dnd2024/session/player-session/vitals";
import { PanelSection } from "@/components/session/gm-panel/scene-tab";
import { useSessionActions } from "@/hooks/use-session-actions";
import { tokenLabel } from "@/lib/format";
import type { WithId } from "@/lib/collections";
import { companionOwnerId } from "@/systems/dnd2024/lib/companions";
import { cn } from "@/lib/utils";
import { combatantColor } from "@/lib/combatant-color";

export interface CombatTabProps {
  session: WithId<LiveSession>;
  enemies: WithId<AdventureEnemy>[];
  /** NPCs with a combat profile join a fight as allies. */
  npcs: WithId<AdventureNpc>[];
  participants: WithId<AdventureParticipant>[];
  combatants: WithId<SessionCombatant>[];
  charactersById: Record<string, WithId<ReadyCharacter>>;
  locationOptions: LocationOption[];
  conditionsEnabled: boolean;
  /** Open a character's sheet (participants). */
  onInspect: (characterId: string) => void;
}

/** Reinforcements bring no character: a stable empty list (a fresh `[]` would reset the dialog). */
const NO_PARTICIPANTS: WithId<AdventureParticipant>[] = [];

const colorOf = (c: SessionCombatant) => combatantColor(c);

/** Hit points: one −, one +, the number opens the pad; temp HP as a chip. */
export function VitalsControl({
  name,
  current,
  max,
  temp,
  onHitPoints,
  onTemp,
}: {
  name: string;
  current: number;
  max: number;
  temp: number;
  onHitPoints: (value: number) => void;
  /** Absent for enemies: they have no temporary hit points. */
  onTemp?: (value: number) => void;
}) {
  const [pad, setPad] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      {temp > 0 && (
        <span className="rounded-full border border-dashed border-sky-400 px-1.5 text-[11px] font-bold text-sky-600 tabular-nums dark:text-sky-300">
          +{temp}
        </span>
      )}
      <HpStepper
        size="sm"
        current={current}
        max={max}
        temp={temp}
        onHitPoints={onHitPoints}
        onTemp={onTemp ?? (() => {})}
        onValueClick={() => setPad(true)}
      />
      <HpPadDialog
        target={pad ? { name, current, max, temp } : null}
        onClose={() => setPad(false)}
        onHitPoints={onHitPoints}
        onTemp={onTemp}
      />
    </span>
  );
}

/** A combatant's hit points; a character's go to its participant (and token). */
function CombatantHp({
  combatant,
  participant,
}: {
  combatant: WithId<SessionCombatant>;
  participant?: WithId<AdventureParticipant>;
}) {
  const { onCombatantHitPoints, onParticipantVitals } = useSessionActions();
  return (
    <VitalsControl
      name={combatant.name}
      current={combatant.currentHitPoints}
      max={combatant.maxHitPoints}
      temp={participant?.temporaryHitPoints ?? 0}
      onHitPoints={(value) =>
        participant
          ? onParticipantVitals(participant.characterId, { currentHitPoints: value })
          : onCombatantHitPoints(combatant.id, value)
      }
      onTemp={
        participant
          ? (value) => onParticipantVitals(participant.characterId, { temporaryHitPoints: value })
          : undefined
      }
    />
  );
}

/**
 * « Combat » tab. Before: the enemies waiting here and « Lancer le combat ».
 * During: the initiative order, each row with its hit points, the active
 * enemy's attacks unfolded, and « Suivant ».
 */
export function CombatTab({
  session,
  enemies,
  npcs,
  participants,
  combatants,
  charactersById,
  locationOptions,
  conditionsEnabled,
  onInspect,
}: CombatTabProps) {
  const { t } = useTranslation("session", { keyPrefix: "combatTab" });
  const {
    onNext,
    onCreateCombat,
    onCreateEnemy,
    onAddEnemiesToCombat,
    onEndCombat,
    onToggleCombatantMap,
    onRemoveCombatant,
    onAddParticipantCombatant,
    onCombatantHitPoints,
    onSetCombatantConditions,
  } = useSessionActions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const combat = session.combat;
  const byId = new Map(combatants.map((c) => [c.id, c]));
  const participantOf = (c: SessionCombatant) =>
    c.kind === "participant" ? participants.find((p) => p.characterId === c.refId) : undefined;
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedEnemy =
    selected?.kind === "enemy" ? enemies.find((e) => e.id === selected.refId) : undefined;

  const dice = <DiceRollerBlock />;

  if (!combat) {
    const here = enemies.filter((e) => e.locationId && e.locationId === session.currentLocationId);
    return (
      <div className="flex flex-col gap-3">
        <PanelSection title={t("enemiesHere")}>
          <div className="grid gap-2 p-2.5">
            {here.length === 0 && <p className="text-muted-foreground text-sm">{t("noneHere")}</p>}
            {here.map((enemy) => (
              <div key={enemy.id} className="flex items-center gap-2 text-sm">
                <span
                  className="grid size-7 place-items-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: enemy.color ?? "#b91c1c" }}
                >
                  {tokenLabel(enemy.name)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{enemy.name}</span>
                <span className="text-muted-foreground text-xs">
                  {t("enemyStats", { ac: enemy.armorClass, hp: enemy.maxHitPoints })}
                </span>
              </div>
            ))}
            <CombatSetupDialog
              trigger={
                <Button type="button" className="w-full" id="gm-start-combat">
                  <SwordsIcon /> {t("start")}
                </Button>
              }
              participants={participants}
              charactersById={charactersById}
              enemies={enemies}
              npcs={npcs}
              onCreate={onCreateCombat}
              onCreateEnemy={onCreateEnemy}
              locationOptions={locationOptions}
            />
          </div>
        </PanelSection>
        {dice}
      </div>
    );
  }

  const order = combat.order
    .map((id, index) => ({ index, combatant: byId.get(id) }))
    .filter((e): e is { index: number; combatant: WithId<SessionCombatant> } => !!e.combatant);
  const nextAlive = (() => {
    for (let k = 1; k <= combat.order.length; k++) {
      const c = byId.get(combat.order[(combat.turnIndex + k) % combat.order.length]);
      if (c && (c.kind === "participant" || c.currentHitPoints > 0)) return c;
    }
    return undefined;
  })();
  const late = participants.filter(
    (p) => !combatants.some((c) => c.kind === "participant" && c.refId === p.characterId),
  );

  return (
    <div className="flex flex-col gap-3" id="gm-combat">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-semibold">{t("round", { round: combat.round })}</span>
        <Button
          type="button"
          id="gm-combat-next"
          className="bg-amber-400 text-amber-950 hover:bg-amber-400/90"
          onClick={onNext}
        >
          <SkipForwardIcon /> {t("next")}
          {nextAlive && <span className="opacity-70">{tokenLabel(nextAlive.name)}</span>}
        </Button>
      </div>

      <ul className="flex flex-col gap-1">
        {order.map(({ index, combatant }) => {
          const active = index === combat.turnIndex;
          const down = combatant.currentHitPoints <= 0;
          const enemy =
            combatant.kind === "enemy" ? enemies.find((e) => e.id === combatant.refId) : undefined;
          const participant = participantOf(combatant);
          const conditions = combatant.conditions ?? participant?.conditions ?? [];
          return (
            <li
              key={combatant.id}
              id={`gm-combatant-${combatant.id}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border border-transparent p-1.5",
                active && "border-amber-400/60 bg-amber-400/10",
                down && combatant.kind === "enemy" && "opacity-45",
              )}
            >
              <span className="text-muted-foreground w-5 text-center text-[11px] font-bold tabular-nums">
                {combatant.initiative ?? "–"}
              </span>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold text-white",
                  active ? "border-amber-300" : "border-transparent",
                )}
                style={{ backgroundColor: colorOf(combatant) }}
              >
                {tokenLabel(combatant.name)}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  combatant.kind === "enemy"
                    ? setSelectedId(combatant.id)
                    : // A familiar opens its character's sheet.
                      onInspect(companionOwnerId(combatant.refId))
                }
              >
                <span className="block text-sm leading-tight font-semibold hover:underline">
                  {combatant.name}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground text-[11px]">
                    {t("ac", { ac: combatant.armorClass })}
                  </span>
                  {participant?.wildShape && (
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      {t("wildShape", { name: participant.wildShape.name })}
                    </span>
                  )}
                  {combatant.kind === "companion" && (
                    <span className="text-muted-foreground text-[11px]">{t("familiar")}</span>
                  )}
                  {combatant.ally && (
                    <span className="rounded border border-teal-500/40 bg-teal-500/10 px-1 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                      {t("ally")}
                    </span>
                  )}
                  {down && (
                    <span className="rounded border border-red-500/40 bg-red-500/10 px-1 text-[10px] font-bold text-red-700 dark:text-red-300">
                      {t(combatant.kind === "enemy" && !combatant.ally ? "out" : "down")}
                    </span>
                  )}
                  {conditions.map((c) => (
                    <span
                      key={c}
                      className="rounded border border-violet-400/40 bg-violet-400/10 px-1 text-[10px] font-bold text-violet-700 dark:text-violet-300"
                    >
                      {CONDITION_LABELS[c]}
                    </span>
                  ))}
                </span>
              </button>
              <CombatantHp combatant={combatant} participant={participant} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t("more", { name: combatant.name })}
                  >
                    <MoreVerticalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => onToggleCombatantMap(combatant.id, !combatant.onMap)}
                  >
                    {combatant.onMap ? <MapPinOffIcon /> : <MapPinIcon />}
                    {t(combatant.onMap ? "offMap" : "onMap")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onRemoveCombatant(combatant.id)}
                  >
                    <Trash2Icon /> {t("remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {active && enemy && !down && (
                <div className="basis-full pl-14">
                  <EnemyAttacks enemy={enemy} compact />
                </div>
              )}
            </li>
          );
        })}
        {combat.order.some((id) => !byId.has(id)) && (
          <li className="text-muted-foreground px-1.5 text-xs">{t("removed")}</li>
        )}
      </ul>

      {late.length > 0 && (
        <div className="grid gap-1">
          <span className="text-muted-foreground text-xs">{t("latePlayer")}</span>
          <div className="flex flex-wrap gap-1.5">
            {late.map((participant) => (
              <Button
                key={participant.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onAddParticipantCombatant(participant)}
              >
                <PlusIcon /> {participant.characterName}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <CombatSetupDialog
          mode="add"
          takenNames={combatants.map((c) => c.name)}
          trigger={
            <Button type="button" size="sm" variant="secondary">
              <PlusIcon /> {t("addEnemies")}
            </Button>
          }
          participants={NO_PARTICIPANTS}
          charactersById={charactersById}
          enemies={enemies}
          npcs={npcs}
          onCreate={onAddEnemiesToCombat}
          onCreateEnemy={onCreateEnemy}
          locationOptions={locationOptions}
        />
        <span className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive"
          id="gm-end-combat"
          onClick={onEndCombat}
        >
          <SwordsIcon /> {t("end")}
        </Button>
      </div>
      {dice}

      <Dialog open={!!selectedEnemy} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selectedEnemy && selected && (
            <EnemyPanel
              enemy={selectedEnemy}
              combatant={selected}
              onHitPoints={onCombatantHitPoints}
              conditionsEnabled={conditionsEnabled}
              onSetConditions={(conditions) => onSetCombatantConditions(selected.id, conditions)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
