/** One chapter of the book: a session with a published recap. */
export interface ChronicleChapter {
  sessionId: string;
  number: number;
  title?: string;
  /** Real-world start of the session (ms). */
  playedAt: number;
  /** Real-world end of the session (ms), when known. */
  endedAt?: number;
  /** In-game day counter (« Jour 3 »). */
  gameDay?: number;
  gameDate?: string;
  recap: string;
  attendees: string[];
  places: string[];
  events: { title: string; description?: string }[];
  documents: string[];
  loot: string[];
  /** Enemies that fell (« Gobelin ×3 »). */
  defeated: string[];
  /** Quests that moved (« Le trésor : accomplie »). */
  quests: string[];
  quotes: { text: string; speaker?: string }[];
  journals: { characterName: string; title?: string; body: string }[];
}

/** The words the Markdown export needs, in the reader's language. */
export interface ChronicleLabels {
  session: (number: number, title?: string) => string;
  playedOn: (date: string) => string;
  present: string;
  places: string;
  events: string;
  documents: string;
  loot: string;
  defeated: string;
  quests: string;
  quotes: string;
  journalOf: (name: string, title?: string) => string;
  /** « Jour 3 ». */
  day?: (day: number) => string;
}

/** Strip `[[ ]]` from mentions: a file has no codex to link to. */
const plain = (text: string) => text.replace(/\[\[([^[\]\n]{1,160})\]\]/g, "$1");

/** One session as Markdown, its heading at `level` (`##` in an adventure, `###` in a campaign). */
function chapterLines(
  c: ChronicleChapter,
  labels: ChronicleLabels,
  formatDate: (start: number, end?: number) => string,
  level: number,
): string[] {
  const h = "#".repeat(level);
  const sub = "#".repeat(level + 1);
  const out: string[] = [`${h} ${labels.session(c.number, c.title)}`, ""];
  const meta = [
    labels.playedOn(formatDate(c.playedAt, c.endedAt)),
    c.gameDay && labels.day?.(c.gameDay),
    c.gameDate,
  ].filter(Boolean);
  out.push(`_${meta.join(" · ")}_`, "");
  if (c.attendees.length) out.push(`**${labels.present}** ${c.attendees.join(", ")}`, "");
  if (c.places.length) out.push(`**${labels.places}** ${c.places.join(" → ")}`, "");
  out.push(plain(c.recap.trim()), "");
  if (c.events.length) {
    out.push(`${sub} ${labels.events}`, "");
    for (const e of c.events) {
      out.push(`- **${e.title}**${e.description ? ` — ${plain(e.description)}` : ""}`);
    }
    out.push("");
  }
  if (c.defeated.length) out.push(`**${labels.defeated}** ${c.defeated.join(", ")}`, "");
  if (c.quests.length) out.push(`**${labels.quests}** ${c.quests.join(" · ")}`, "");
  if (c.documents.length) out.push(`**${labels.documents}** ${c.documents.join(", ")}`, "");
  if (c.loot.length) out.push(`**${labels.loot}** ${c.loot.join(", ")}`, "");
  if (c.quotes.length) {
    out.push(`${sub} ${labels.quotes}`, "");
    for (const q of c.quotes) out.push(`> « ${q.text} »${q.speaker ? ` — ${q.speaker}` : ""}`, "");
  }
  for (const j of c.journals) {
    out.push(`${sub} ${labels.journalOf(j.characterName, j.title)}`, "", plain(j.body.trim()), "");
  }
  return out;
}

const finish = (out: string[]) =>
  out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";

/** The whole chronicle as one Markdown document, ready to download. */
export function chronicleMarkdown(
  heading: { adventure: string; campaign: string; summary?: string },
  chapters: ChronicleChapter[],
  labels: ChronicleLabels,
  formatDate: (start: number, end?: number) => string,
): string {
  const out: string[] = [`# ${heading.adventure}`, "", `_${heading.campaign}_`, ""];
  if (heading.summary?.trim()) out.push(plain(heading.summary.trim()), "");
  for (const c of chapters) out.push(...chapterLines(c, labels, formatDate, 2));
  return finish(out);
}

/** One adventure of the campaign book. */
export interface ChroniclePart {
  adventure: string;
  summary?: string;
  chapters: ChronicleChapter[];
}

/** The book of the whole campaign: every adventure in order, its sessions under it. */
export function campaignChronicleMarkdown(
  heading: { campaign: string; summary?: string },
  parts: ChroniclePart[],
  labels: ChronicleLabels,
  formatDate: (start: number, end?: number) => string,
): string {
  const out: string[] = [`# ${heading.campaign}`, ""];
  if (heading.summary?.trim()) out.push(plain(heading.summary.trim()), "");
  for (const part of parts) {
    out.push(`## ${part.adventure}`, "");
    if (part.summary?.trim()) out.push(`_${plain(part.summary.trim())}_`, "");
    for (const c of part.chapters) out.push(...chapterLines(c, labels, formatDate, 3));
  }
  return finish(out);
}
