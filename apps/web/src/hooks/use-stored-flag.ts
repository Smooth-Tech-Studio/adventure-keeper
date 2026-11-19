import { useCallback, useState } from "react";

const PREFIX = "adventure-keeper:flag:";

function read(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

/**
 * An on/off display preference remembered on this device (localStorage), like
 * "show the map" on the phone a player keeps at the table. Falls back to
 * in-memory state when storage is unavailable.
 */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => read(key, fallback));
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(PREFIX + key, next ? "1" : "0");
      } catch {
        /* storage unavailable — the in-memory state still works */
      }
    },
    [key],
  );
  return [value, set];
}
