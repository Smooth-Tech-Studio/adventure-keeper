/** Small display formatters shared across the UI. */

/** `+3` / `-1` — a signed modifier. */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** In-game time is "night" (moon, not sun) from 22:00 through 06:29. */
export function isNightTime(label: string | undefined): boolean {
  const match = (label ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const minutes = (Number(match[1]) % 24) * 60 + Number(match[2]);
  return minutes >= 22 * 60 || minutes < 6 * 60 + 30;
}

/** Two-letter avatar fallback: initials of the first two words, else 2 chars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * A token's label on the map and in the turn order. Numbered instances keep
 * their number — « Combattant gobelin 2 » → « G2 », from the word just before
 * it — so three goblins no longer all read « CG ». Anything else: initials.
 */
export function tokenLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last = parts.at(-1) ?? "";
  if (parts.length >= 2 && /^\d+$/.test(last)) {
    return `${parts[parts.length - 2][0].toUpperCase()}${last}`;
  }
  return initials(name);
}
