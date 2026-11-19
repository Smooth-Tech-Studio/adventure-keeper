import { useState } from "react";
import { isDnd2024Character, type Companion } from "@adventure-keeper/schemas";
import { hasWildShape, type SpellDef } from "@adventure-keeper/system-dnd2024";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { EndTurnButton } from "@/components/session/player-session/game-tab";
import {
  FIND_FAMILIAR,
  canSummonFamiliar,
  companionRefId,
  familiarFromMonster,
  wildShapeBeast,
} from "@/systems/dnd2024/lib/companions";
import { limitedFeatures } from "@/systems/dnd2024/lib/player-actions";
import {
  ActionEconomy,
  AttackList,
  CapacityCard,
  CombatSpellList,
  ConcentrationBanner,
  InitiativeRow,
  SheetChecks,
  SpellSlots,
} from "@/systems/dnd2024/session/player-session/actions-tab";
import {
  AbilityScores,
  CharacterIdentity,
  HpBar,
  HpStepper,
  InspirationToggle,
  KeyStats,
  TempHpButton,
} from "@/systems/dnd2024/session/player-session/vitals";
import { BagTab } from "@/systems/dnd2024/session/player-sheet/bag-tab";
import { CastDialog } from "@/systems/dnd2024/session/player-sheet/cast-dialog";
import {
  FamiliarCard,
  SummonFamiliarDialog,
} from "@/systems/dnd2024/session/player-sheet/familiar-card";
import { SessionHud } from "@/systems/dnd2024/session/player-sheet/session-hud";
import { SpellsTab } from "@/systems/dnd2024/session/player-sheet/spells-tab";
import { WildShapeCard } from "@/systems/dnd2024/session/player-sheet/wild-shape-card";
import { XpBanner } from "@/systems/dnd2024/session/player-sheet/xp-banner";
import type { PlayerPanelProps } from "@/systems/screen-types";

/** The druid's Wild Shape feature (its uses spent are kept under this id). */
const WILD_SHAPE_FEATURE = "druid:2:Forme sauvage";

/**
 * What a 5e 2024 character brings to its player's session: the header of the
 * sheet, the actions of a turn, spells, bag, familiar and Wild Shape. The
 * session view (`components/session/player-session-view.tsx`) lays them out,
 * on a phone and on a computer.
 */
export function Dnd2024PlayerPanel({
  session,
  combatants,
  myParticipant,
  myCharacter,
  conditionsEnabled,
  hitPoints,
  maxHitPoints,
  temp,
  setHitPoints,
  setTemp,
  turn,
  onRoll: setRollSpec,
  onCharacterItemsChange,
  onParticipantStateChange,
  onCashInXp,
  onApplyLevel,
  onEndTurn,
  onMyCombatantChange,
  onCompanionCombatantHp,
  onCompanionJoinCombat,
  onRemoveCompanionCombatant,
  children,
}: PlayerPanelProps) {
  const { t } = useTranslation("session");
  const [casting, setCasting] = useState<SpellDef | null>(null);
  const [summoning, setSummoning] = useState(false);

  const dnd = isDnd2024Character(myCharacter) ? myCharacter : null;
  // Under Wild Shape, the beast's AC and speed are the ones asked for.
  const beast = myParticipant.wildShape ? wildShapeBeast(myParticipant.wildShape.monsterId) : null;
  const shown =
    dnd && beast
      ? { ...dnd, armorClass: beast.monster.armorClass, speed: beast.monster.speed }
      : dnd;
  // A non-caster can still hold spells from its species (elven lineage, fiendish legacy).
  const hasSpells =
    !!dnd && (dnd.spellcastingAbility != null || (dnd.grantedSpells ?? []).length > 0);

  const xp = dnd ? (
    <XpBanner
      character={dnd}
      participant={myParticipant}
      onCashInXp={onCashInXp}
      onApplyLevel={onApplyLevel}
    />
  ) : null;
  const hp = (size?: "md" | "lg") => (
    <HpStepper
      current={hitPoints}
      max={maxHitPoints}
      temp={temp}
      onHitPoints={setHitPoints}
      onTemp={setTemp}
      size={size}
    />
  );
  const inspiration = dnd ? (
    <InspirationToggle
      active={myParticipant.heroicInspiration ?? false}
      onToggle={() =>
        onParticipantStateChange({ heroicInspiration: !myParticipant.heroicInspiration })
      }
    />
  ) : null;
  // Death saves, spell DC, exhaustion, conditions: what the header leaves out.
  const hud = dnd ? (
    <SessionHud
      character={dnd}
      participant={myParticipant}
      conditionsEnabled={conditionsEnabled}
      currentHitPoints={hitPoints}
      onParticipantStateChange={onParticipantStateChange}
    />
  ) : null;
  // Beside the map: who, how hurt, the key numbers.
  // Above the tabs, whichever is open: the spell held, and the save after damage.
  const concentrationBanner = dnd ? (
    <ConcentrationBanner
      character={dnd}
      participant={myParticipant}
      pool={{ hitPoints, temp }}
      onParticipantStateChange={onParticipantStateChange}
      onRoll={setRollSpec}
    />
  ) : null;
  const sheetHeader = dnd ? (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <CharacterIdentity character={dnd} />
        {inspiration}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {hp()}
        <TempHpButton temp={temp} onTemp={setTemp} />
      </div>
      <HpBar current={hitPoints} max={maxHitPoints} temp={temp} />
      <KeyStats character={shown!} />
      <AbilityScores character={dnd} />
      {xp}
      {concentrationBanner}
    </div>
  ) : null;
  // --- Familiar and Wild Shape ------------------------------------------------
  const familiar = dnd?.companions?.find((c) => c.kind === "familiar");
  const familiarToken = familiar
    ? combatants.find(
        (c) =>
          c.kind === "companion" &&
          c.refId === companionRefId(myParticipant.characterId, familiar.id),
      )
    : undefined;
  const setFamiliar = (next: Companion | null) =>
    onCharacterItemsChange({
      companions: [
        ...(dnd?.companions ?? []).filter((c) => c.kind !== "familiar"),
        ...(next ? [next] : []),
      ],
    });
  const familiarCard = dnd ? (
    <FamiliarCard
      companion={familiar}
      hitPoints={familiarToken?.currentHitPoints}
      canSummon={canSummonFamiliar(dnd)}
      inCombat={
        !session.combat
          ? "none"
          : familiarToken && session.combat.order.includes(familiarToken.id)
            ? "in"
            : "joinable"
      }
      onSummon={() => setSummoning(true)}
      onHitPoints={(value) => {
        if (familiarToken) onCompanionCombatantHp(familiarToken.id, value);
        if (familiar) setFamiliar({ ...familiar, currentHitPoints: value });
      }}
      onJoinCombat={() => {
        if (!familiar) return;
        void onCompanionJoinCombat(familiar).then((initiative) => {
          if (initiative !== undefined)
            toast(t("familiar.joined", { name: familiar.name, initiative }));
        });
      }}
      onDismiss={() => {
        if (familiarToken) onRemoveCompanionCombatant(familiarToken.id);
        setFamiliar(null);
      }}
      onRoll={setRollSpec}
    />
  ) : null;
  const wildShapeUse = dnd
    ? limitedFeatures(dnd).find((feature) => feature.id === WILD_SHAPE_FEATURE)
    : undefined;
  const wildShapeSpent = myParticipant.featureUsesSpent?.[WILD_SHAPE_FEATURE] ?? 0;
  const wildShape =
    dnd && hasWildShape(dnd.classId, dnd.level ?? 1) ? (
      <WildShapeCard
        character={dnd}
        participant={myParticipant}
        usesLeft={Math.max(0, (wildShapeUse?.max ?? 0) - wildShapeSpent)}
        sheetHref={`/characters/${myParticipant.characterId}`}
        onShape={(monster) => {
          if (!monster) {
            onParticipantStateChange({ wildShape: null });
            onMyCombatantChange({
              armorClass: dnd.armorClass ?? 10 + dnd.abilityModifiers.dex,
              size: dnd.size ?? "medium",
            });
            return;
          }
          // A use spent, and the druid level in temporary HP (the higher pool stays).
          const gained = Math.max(temp, dnd.level ?? 1);
          setTemp(gained);
          onParticipantStateChange({
            wildShape: { monsterId: monster.id, name: monster.name },
            featureUsesSpent: {
              ...myParticipant.featureUsesSpent,
              [WILD_SHAPE_FEATURE]: wildShapeSpent + 1,
            },
          });
          // The token takes the beast's AC and its size (a bear covers 2 × 2 squares).
          onMyCombatantChange({ armorClass: monster.armorClass, size: monster.size });
          toast(t("wildShape.done", { name: monster.name, temp: gained }));
        }}
        onRoll={setRollSpec}
      />
    ) : null;

  // What the player does this turn: attacks, then spells, then the rest.
  const actions = dnd ? (
    <>
      {turn?.mine && <ActionEconomy turnKey={`${turn.combat.round}-${turn.combat.turnIndex}`} />}
      {/* Before the fight: the GM calls for initiative. */}
      {!turn && <InitiativeRow character={dnd} participant={myParticipant} onRoll={setRollSpec} />}
      <AttackList character={dnd} onRoll={setRollSpec} />
      <CombatSpellList
        character={dnd}
        onRoll={setRollSpec}
        onCast={setCasting}
        slots={
          <SpellSlots
            character={dnd}
            participant={myParticipant}
            onParticipantStateChange={onParticipantStateChange}
          />
        }
      />
      <CapacityCard
        character={dnd}
        participant={myParticipant}
        onParticipantStateChange={onParticipantStateChange}
        onRoll={setRollSpec}
      />
      {wildShape}
      {familiarCard}
      {hud}
    </>
  ) : null;
  const checks = dnd ? <SheetChecks character={dnd} onRoll={setRollSpec} /> : null;
  const spells =
    dnd && hasSpells ? (
      <SpellsTab
        character={dnd}
        participant={myParticipant}
        onParticipantStateChange={onParticipantStateChange}
        onRoll={setRollSpec}
        onCast={setCasting}
      />
    ) : null;
  const bag = dnd ? (
    <BagTab character={dnd} onCharacterItemsChange={onCharacterItemsChange} />
  ) : null;
  const castDialog = dnd ? (
    <>
      <CastDialog
        spell={casting}
        character={dnd}
        participant={myParticipant}
        onParticipantStateChange={onParticipantStateChange}
        onRoll={setRollSpec}
        // « Appel de familier » calls one once cast.
        onCast={(spell) => spell.id === FIND_FAMILIAR && setSummoning(true)}
        onClose={() => setCasting(null)}
      />
      <SummonFamiliarDialog
        open={summoning}
        onOpenChange={setSummoning}
        onSummon={(monster, name) => {
          const next = familiarFromMonster(monster, name, `f${Date.now().toString(36)}`);
          // A familiar called again replaces the one before (one at a time).
          if (familiarToken) onRemoveCompanionCombatant(familiarToken.id);
          setFamiliar(next);
          setSummoning(false);
          toast(t("familiar.summoned", { name: next.name }));
        }}
      />
    </>
  ) : null;

  return children({
    sheetHeader,
    sheetTabs: dnd
      ? [
          { id: "actions", label: t("player.tabs.actions"), content: actions },
          ...(spells
            ? [{ id: "sorts" as const, label: t("sheet.tabs.spells"), content: spells }]
            : []),
          { id: "fiche", label: t("player.tabs.sheet"), content: checks },
          { id: "sac", label: t("sheet.tabs.bag"), content: bag },
        ]
      : [],
    notesInSheet: false,
    me: dnd ? (
      <div className="flex flex-col gap-3">
        <>
          {xp}
          <div className="bg-card flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex justify-center">{hp("lg")}</div>
            <HpBar current={hitPoints} max={maxHitPoints} temp={temp} />
            <div className="flex items-center gap-2">
              <TempHpButton temp={temp} onTemp={setTemp} />
              <span className="text-muted-foreground ml-auto text-xs">{t("player.tempFirst")}</span>
            </div>
          </div>
          <div className="bg-card rounded-xl border">
            <KeyStats character={shown!} />
          </div>
          <AbilityScores character={dnd} />
          <div className="flex justify-end">{inspiration}</div>
          {actions}
          {checks}
          {turn?.mine && <EndTurnButton onEndTurn={onEndTurn} />}
        </>
        ,
      </div>
    ) : null,
    spells,
    bag,
    phoneStat: dnd ? (
      <span className="text-muted-foreground text-xs">
        {t("sheet.hud.ac")} {shown!.armorClass ?? 10 + dnd.abilityModifiers.dex}
      </span>
    ) : null,
    banner: concentrationBanner,
    dialogs: castDialog,
  });
}
