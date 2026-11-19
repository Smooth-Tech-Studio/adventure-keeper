import { useCallback, useEffect, useState } from "react";

import { WriteBuffer, type WriteBufferOptions } from "@/lib/write-buffer";

export interface BufferedWrites<T> {
  /** Local values to show over the remote ones, by key. */
  values: Readonly<Record<string, T>>;
  /** Show `value` now; write it once the burst is over. */
  set: (key: string, value: T) => void;
  /** Write `key` now (e.g. when a dragged token is dropped). */
  flush: (key: string) => void;
}

/**
 * A {@link WriteBuffer} bound to a component: re-renders on change, writes
 * whatever is pending when the tab is hidden or the component unmounts.
 */
export function useBufferedWrites<T>(
  commit: (key: string, value: T) => void,
  options: WriteBufferOptions = {},
): BufferedWrites<T> {
  const [values, setValues] = useState<Readonly<Record<string, T>>>({});
  const [buffer] = useState(() => {
    const created: WriteBuffer<T> = new WriteBuffer<T>(commit, options, () =>
      setValues(created.values),
    );
    return created;
  });

  // Commit and timings may change between renders (the session's mode is
  // known once it has loaded): the buffer follows.
  useEffect(() => {
    buffer.setCommit(commit);
    buffer.setOptions(options);
  });

  useEffect(() => {
    const flushIfHidden = () => {
      if (document.visibilityState === "hidden") buffer.flushAll();
    };
    const flushAll = () => buffer.flushAll();
    document.addEventListener("visibilitychange", flushIfHidden);
    window.addEventListener("pagehide", flushAll);
    return () => {
      document.removeEventListener("visibilitychange", flushIfHidden);
      window.removeEventListener("pagehide", flushAll);
      buffer.flushAll();
      buffer.dispose();
    };
  }, [buffer]);

  const set = useCallback((key: string, value: T) => buffer.set(key, value), [buffer]);
  const flush = useCallback((key: string) => buffer.flush(key), [buffer]);
  return { values, set, flush };
}

const SINGLE = "value";

/**
 * One buffered value: shows the local edit right away, writes it once the
 * burst is over, and goes back to the remote value afterwards.
 *
 *   const [hp, setHp] = useBufferedValue(currentHitPoints, onHitPointsChange, { delay: 800 });
 */
export function useBufferedValue<T>(
  remote: T,
  commit: (value: T) => void,
  options?: WriteBufferOptions,
): [T, (value: T) => void] {
  const { values, set } = useBufferedWrites<T>((_, value) => commit(value), options);
  const setValue = useCallback((value: T) => set(SINGLE, value), [set]);
  return [SINGLE in values ? values[SINGLE] : remote, setValue];
}
