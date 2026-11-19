/**
 * The files outside `apps/web/src/systems` that still reach into the 5e
 * folder (`@/systems/dnd2024/…`) instead of asking `@/systems`.
 *
 * They are features shaped by 5e without being about one sheet — enemies,
 * conditions, loot and purses, content packs — plus the creation page and the
 * player's session view, which still route between systems themselves. The
 * list only shrinks: take a file out when it goes through `@/systems`, never
 * add one. See `docs/RULES_AND_CONTENT.md`, lot 1.
 */
export const REACHES_INTO_DND = [
  "apps/web/src/App.tsx",
  "apps/web/src/components/adventure/drafts.ts",
  "apps/web/src/components/adventure/enemy-attack-list-editor.tsx",
  "apps/web/src/components/adventure/enemy-editor.tsx",
  "apps/web/src/components/adventure/enemy-form-dialog.tsx",
  "apps/web/src/components/adventure/enemy-form.ts",
  "apps/web/src/components/adventure/monster-picker.tsx",
  "apps/web/src/components/adventure/planned-loot-field.tsx",
  "apps/web/src/components/campaign/campaign-packs-card.tsx",
  "apps/web/src/components/campaign/member-row.tsx",
  "apps/web/src/components/character/character-sheet/primitives.tsx",
  "apps/web/src/components/character/item-list-editor.tsx",
  "apps/web/src/components/character/standard-character-form.tsx",
  "apps/web/src/components/session/enemy-panel.tsx",
  "apps/web/src/components/session/gm-panel/combat-tab.tsx",
  "apps/web/src/components/session/gm-panel/give-loot.tsx",
  "apps/web/src/components/session/inspect-character-dialog.tsx",
  "apps/web/src/components/session/loot-offer-prompt.tsx",
  "apps/web/src/components/session/player-session-view.tsx",
  "apps/web/src/components/session/standard-player-panel.tsx",
  "apps/web/src/components/wizard/guided-flow.tsx",
  "apps/web/src/hooks/use-live-session-data.ts",
  "apps/web/src/hooks/use-session-actions.tsx",
  "apps/web/src/lib/account.ts",
  "apps/web/src/lib/campaign-file-build.ts",
  "apps/web/src/lib/campaign-file.ts",
  "apps/web/src/lib/loot-offers.ts",
  "apps/web/src/lib/map-scale.ts",
  "apps/web/src/lib/planned-loot.ts",
  "apps/web/src/lib/sort.test.ts",
  "apps/web/src/pages/adventures/adventure-detail.tsx",
  "apps/web/src/pages/adventures/create-adventure.tsx",
  "apps/web/src/pages/campaigns/campaign-detail.tsx",
  "apps/web/src/pages/campaigns/campaign-format-page.tsx",
  "apps/web/src/pages/campaigns/create-campaign.tsx",
  "apps/web/src/pages/characters/characters-list.tsx",
  "apps/web/src/pages/sessions/game-session.tsx",
];
