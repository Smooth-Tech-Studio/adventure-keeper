/**
 * A part of the live-session view that can be opened alone, in its own tab
 * (`…/session/:sessionId/:pane`):
 * - `carte` — the map as the players see it (opaque fog, read-only), for a
 *   player's second screen or the table's TV;
 * - `carte-mj` — the GM's map (translucent fog, tokens and brushes editable);
 * - `outils` — the side panel: GM control panel, or the player's sheet.
 */
export type SessionPane = "carte" | "carte-mj" | "outils";

const SESSION_PANES: readonly string[] = ["carte", "carte-mj", "outils"] satisfies SessionPane[];

export function isSessionPane(value: string): value is SessionPane {
  return SESSION_PANES.includes(value);
}

export function sessionPath(campaignId: string, adventureId: string, sessionId: string): string {
  return `/campaigns/${campaignId}/adventures/${adventureId}/session/${sessionId}`;
}
