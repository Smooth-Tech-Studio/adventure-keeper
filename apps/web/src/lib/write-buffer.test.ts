import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WriteBuffer } from "./write-buffer";

describe("WriteBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes only the last value of a burst, once it is over", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 800 });

    for (const hp of [30, 29, 28, 27, 26]) {
      buffer.set("thorin", hp);
      vi.advanceTimersByTime(100);
    }
    expect(commit).not.toHaveBeenCalled();
    expect(buffer.values.thorin).toBe(26);

    vi.advanceTimersByTime(800);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith("thorin", 26);
  });

  it("writes each change at once with delay 0 (a realtime room)", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 0 });

    for (const hp of [30, 29, 28]) buffer.set("gobelin", hp);
    expect(commit.mock.calls).toEqual([
      ["gobelin", 30],
      ["gobelin", 29],
      ["gobelin", 28],
    ]);
    // Still shown over the remote value until the room's echo settles in.
    expect(buffer.values.gobelin).toBe(28);
    vi.advanceTimersByTime(1_000);
    expect(buffer.values.gobelin).toBeUndefined();
  });

  it("follows new timings, e.g. once the session turns out to be on a room", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 800 });

    buffer.set("gobelin", 7);
    expect(commit).not.toHaveBeenCalled();
    buffer.setOptions({ delay: 0 });
    buffer.set("gobelin", 6);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith("gobelin", 6);
    // The old pending timer does not write again.
    vi.advanceTimersByTime(800);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("writes at least every maxWait while changes keep coming", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 300, maxWait: 300 });

    // A drag: a move every 16 ms for ~1 s.
    for (let i = 0; i < 60; i++) {
      buffer.set("token", i);
      vi.advanceTimersByTime(16);
    }
    expect(commit.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(commit.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("flushes a key on demand, and only if it changed", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 300 });

    buffer.set("token", 1);
    buffer.flush("token");
    buffer.flush("token");
    expect(commit).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1_000);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("keys are independent", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 300 });

    buffer.set("a", 1);
    buffer.set("b", 2);
    buffer.flush("a");
    expect(commit).toHaveBeenCalledWith("a", 1);
    expect(commit).not.toHaveBeenCalledWith("b", 2);

    buffer.flushAll();
    expect(commit).toHaveBeenCalledWith("b", 2);
  });

  it("keeps showing a written value while it settles, then lets go", () => {
    const onChange = vi.fn();
    const buffer = new WriteBuffer<number>(vi.fn(), { delay: 300, settle: 1_000 }, onChange);

    buffer.set("thorin", 12);
    vi.advanceTimersByTime(300);
    expect(buffer.values.thorin).toBe(12);

    vi.advanceTimersByTime(1_000);
    expect("thorin" in buffer.values).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("a new change while settling keeps the value and writes again", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 300, settle: 1_000 });

    buffer.set("thorin", 12);
    vi.advanceTimersByTime(300);
    vi.advanceTimersByTime(500);
    buffer.set("thorin", 11);
    vi.advanceTimersByTime(700);
    // The first settle timer would have fired here: the new value must stay.
    expect(buffer.values.thorin).toBe(11);
    expect(commit).toHaveBeenLastCalledWith("thorin", 11);
  });

  it("dispose drops pending timers without writing", () => {
    const commit = vi.fn();
    const buffer = new WriteBuffer<number>(commit, { delay: 300 });

    buffer.set("thorin", 12);
    buffer.dispose();
    vi.advanceTimersByTime(1_000);
    expect(commit).not.toHaveBeenCalled();
  });
});
