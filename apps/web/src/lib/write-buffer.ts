/** Quiet time before writing a value set by +/− buttons (HP, clock). */
export const STEPPER_WRITE_MS = 800;

export interface WriteBufferOptions {
  /**
   * Quiet time (ms) after the last change before writing. `0` writes each
   * change at once (a realtime room, where a message costs nothing).
   */
  delay?: number;
  /** Longest time (ms) a change may wait while changes keep coming. */
  maxWait?: number;
  /** How long (ms) a written value keeps masking the remote one. */
  settle?: number;
}

interface KeyTimers {
  idle?: ReturnType<typeof setTimeout>;
  max?: ReturnType<typeof setTimeout>;
  settle?: ReturnType<typeof setTimeout>;
}

/**
 * Holds back Firestore writes that come in bursts — a token dragged across the
 * map, a "−1 PV" button hammered five times, the clock stepped by +30 four
 * times — and sends only the latest value per key:
 *
 * - `delay` after the last change (the burst is over);
 * - and, with `maxWait`, at least that often while changes keep coming, so the
 *   other players still see a dragged token move.
 *
 * Every Firestore write is billed, and re-read by every client listening to the
 * document: a write per `pointermove` drained the daily quota mid-session.
 *
 * The value is shown locally right away (`values`). After a flush it stays
 * there `settle` ms more, so the screen doesn't flash back to the old value
 * before the write's own snapshot comes back; then the remote value takes over
 * again (which also shows the truth if the write was refused).
 *
 * With `delay: 0` nothing is held back: each change is written as it comes,
 * and only the `settle` masking remains.
 */
export class WriteBuffer<T> {
  /** Values to show over the remote ones: pending, or just written. */
  values: Readonly<Record<string, T>> = {};

  private readonly dirty = new Set<string>();
  private readonly timers = new Map<string, KeyTimers>();
  private delay = 600;
  private maxWait: number | undefined;
  private settle = 1_000;

  constructor(
    private commit: (key: string, value: T) => void,
    options: WriteBufferOptions = {},
    private readonly onChange: () => void = () => {},
  ) {
    this.setOptions(options);
  }

  /** Change the timings, e.g. once the session turns out to play on a realtime room. */
  setOptions(options: WriteBufferOptions) {
    this.delay = options.delay ?? 600;
    this.maxWait = options.maxWait;
    this.settle = options.settle ?? 1_000;
  }

  /** Swap the write callback (it may close over fresh props). */
  setCommit(commit: (key: string, value: T) => void) {
    this.commit = commit;
  }

  set(key: string, value: T) {
    this.values = { ...this.values, [key]: value };
    this.dirty.add(key);
    const timers = this.timersOf(key);
    clearTimeout(timers.settle);
    timers.settle = undefined;
    if (this.delay <= 0) {
      this.flush(key);
      this.onChange();
      return;
    }
    clearTimeout(timers.idle);
    timers.idle = setTimeout(() => this.flush(key), this.delay);
    if (this.maxWait !== undefined && timers.max === undefined) {
      timers.max = setTimeout(() => this.flush(key), this.maxWait);
    }
    this.onChange();
  }

  /** Write `key` now if it has a pending change. */
  flush(key: string) {
    const timers = this.timersOf(key);
    clearTimeout(timers.idle);
    clearTimeout(timers.max);
    timers.idle = timers.max = undefined;
    if (!this.dirty.delete(key)) return;
    this.commit(key, this.values[key]);
    timers.settle = setTimeout(() => this.release(key), this.settle);
  }

  /** Write every pending change now (unmount, tab hidden). */
  flushAll() {
    for (const key of [...this.dirty]) this.flush(key);
  }

  /** Drop every timer without writing, e.g. after `flushAll` on unmount. */
  dispose() {
    for (const timers of this.timers.values()) {
      clearTimeout(timers.idle);
      clearTimeout(timers.max);
      clearTimeout(timers.settle);
    }
    this.timers.clear();
  }

  private release(key: string) {
    const rest = { ...this.values };
    delete rest[key];
    this.values = rest;
    this.timers.delete(key);
    this.onChange();
  }

  private timersOf(key: string): KeyTimers {
    let timers = this.timers.get(key);
    if (!timers) {
      timers = {};
      this.timers.set(key, timers);
    }
    return timers;
  }
}
