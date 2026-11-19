import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RoomRecord } from "./room";

/**
 * Rooms on disk, one JSON file each, so a restart loses nothing. Writes are
 * grouped (one per room every `delayMs` at most) and atomic (temp file, then
 * rename).
 */
export class RoomStore {
  private pending = new Map<string, RoomRecord>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private dir: string,
    private delayMs = 1000,
  ) {}

  private file(id: string) {
    // Room ids are Firestore ids: letters and digits. Anything else is refused.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("bad room id");
    return path.join(this.dir, `${id}.json`);
  }

  async load(id: string): Promise<RoomRecord | null> {
    try {
      return JSON.parse(await readFile(this.file(id), "utf8")) as RoomRecord;
    } catch {
      return null;
    }
  }

  save(record: RoomRecord): void {
    this.pending.set(record.id, record);
    this.timer ??= setTimeout(() => void this.flush(), this.delayMs);
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const batch = [...this.pending.values()];
    this.pending.clear();
    await mkdir(this.dir, { recursive: true });
    await Promise.all(
      batch.map(async (record) => {
        const target = this.file(record.id);
        const temp = `${target}.tmp`;
        await writeFile(temp, JSON.stringify(record));
        await rename(temp, target);
      }),
    );
  }

  /** Forget rooms nobody has touched for `days` (a session long over). */
  async prune(days: number, now = Date.now()): Promise<number> {
    let removed = 0;
    try {
      for (const name of await readdir(this.dir)) {
        if (!name.endsWith(".json")) continue;
        const file = path.join(this.dir, name);
        if (now - (await stat(file)).mtimeMs > days * 86_400_000) {
          await rm(file);
          removed += 1;
        }
      }
    } catch {
      // No directory yet: nothing to prune.
    }
    return removed;
  }
}
