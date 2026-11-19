import { StandardPlayerPanel } from "@/components/session/standard-player-panel";
import { tr } from "@/i18n";
import type { PlayerPanelProps } from "@/systems/screen-types";

/** A free sheet in a session: one panel — hit points, inventory, notes. */
export function StandardPanel({
  myCharacter,
  myParticipant,
  hitPoints,
  maxHitPoints,
  setHitPoints,
  onNotesChange,
  onCharacterItemsChange,
  children,
}: PlayerPanelProps) {
  const panel =
    myCharacter.system === "standard" ? (
      <StandardPlayerPanel
        character={myCharacter}
        participant={myParticipant}
        currentHitPoints={hitPoints}
        maxHitPoints={maxHitPoints}
        onHitPointsChange={setHitPoints}
        onNotesChange={onNotesChange}
        onCharacterItemsChange={onCharacterItemsChange}
      />
    ) : null;
  return children({
    sheetHeader: null,
    sheetTabs: [{ id: "actions", label: tr("session:player.tabs.actions"), content: panel }],
    notesInSheet: true,
    me: panel,
    spells: null,
    bag: null,
    phoneStat: null,
    banner: null,
    dialogs: null,
  });
}
