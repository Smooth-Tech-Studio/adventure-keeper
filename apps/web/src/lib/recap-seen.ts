/**
 * Which published recap a player has read, per adventure, on this device.
 * A convenience for the "new recap" badge: losing it only shows the badge
 * again.
 */
const key = (adventureId: string) => `ak:recap-seen:${adventureId}`;

export function recapSeenAt(adventureId: string): number {
  try {
    return Number(localStorage.getItem(key(adventureId))) || 0;
  } catch {
    return 0;
  }
}

export function markRecapSeen(adventureId: string, at: number): void {
  try {
    if (recapSeenAt(adventureId) < at) localStorage.setItem(key(adventureId), String(at));
  } catch {
    // Storage unavailable (private mode…): the badge just stays.
  }
}

/** Whether the adventure has a recap published after the last one read here. */
export function hasUnreadRecap(adventure: { id: string; lastRecapAt?: number }): boolean {
  return Boolean(adventure.lastRecapAt) && adventure.lastRecapAt! > recapSeenAt(adventure.id);
}
