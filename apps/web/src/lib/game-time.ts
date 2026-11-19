import { currentLanguage, tr } from "@/i18n";

/**
 * The game's own time: a day counter (« Jour 3 ») and the clock (« HH:MM »),
 * both moved by the GM. Nothing here follows real time — an event « at
 * 22:00 » comes due when the GM's clock gets there.
 */

export interface GameTime {
  /** 1-based; absent on sessions from before the counter. */
  day?: number;
  /** `HH:MM`, or free text the GM typed. */
  time?: string;
}

/** Minutes since midnight, or `null` when the label is not `HH:MM`. */
export function minutesOf(label: string | undefined): number | null {
  const match = (label ?? "").trim().match(/^(\d{1,2})[:h](\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

const label = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * The clock moved by `deltaMinutes`: past midnight the day goes up, back
 * before it the day goes down (never under 1). A clock not set yet starts at
 * noon on day 1.
 */
export function stepGameTime(current: GameTime, deltaMinutes: number): Required<GameTime> {
  const base = minutesOf(current.time) ?? 12 * 60;
  const total = base + deltaMinutes;
  const days = Math.floor(total / 1440);
  return {
    day: Math.max(1, (current.day ?? 1) + days),
    time: label(((total % 1440) + 1440) % 1440),
  };
}

/** When an event is due: a day and a time, a day alone, or a time on any day. */
export interface GameMoment {
  day?: number;
  time?: string;
}

/** Whether the clock has reached `moment` (a moment with neither part never comes). */
export function isDue(moment: GameMoment, now: GameTime): boolean {
  const at = minutesOf(moment.time);
  const clock = minutesOf(now.time);
  if (moment.day == null) return at != null && clock != null && clock >= at;
  const today = now.day ?? 1;
  if (today !== moment.day) return today > moment.day;
  return at == null || (clock != null && clock >= at);
}

/** Whole minutes between two instants (ms), or `null` when either is missing. */
export function minutesBetween(start: number, end: number): number | null {
  if (!start || !end || end < start) return null;
  return Math.floor((end - start) / 60000);
}

/** « Jour 3, 22:00 », « Jour 3 », « 22:00 » — or `""` when nothing is set. */
export function momentLabel(moment: GameMoment): string {
  if (moment.day != null && moment.time) {
    return tr("session:clock.dayAt", { day: moment.day, time: moment.time });
  }
  if (moment.day != null) return tr("session:clock.day", { day: moment.day });
  return moment.time ?? "";
}

/** « 45 min », « 3 h », « 3 h 15 ». */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return tr("adventures:past.minutes", { count: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? tr("adventures:past.hoursMinutes", { h, m }) : tr("adventures:past.hours", { h });
}

/**
 * When a session was played, real time: « 14 oct. 2026, 20:30 → 23:45
 * (3 h 15) », the end left out while it is still running or unknown.
 */
export function sessionSpanLabel(start: number, end?: number): string {
  if (!start) return tr("adventures:past.unknownDate");
  const lang = currentLanguage();
  const day = new Date(start).toLocaleDateString(lang, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const hour = (ms: number) =>
    new Date(ms).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  const minutes = end ? minutesBetween(start, end) : null;
  if (!end || minutes == null) return tr("adventures:past.startedAt", { day, time: hour(start) });
  return tr("adventures:past.span", {
    day,
    start: hour(start),
    end: hour(end),
    duration: durationLabel(minutes),
  });
}
