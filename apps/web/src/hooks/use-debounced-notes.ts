import { useBufferedValue } from "@/hooks/use-buffered-writes";

/**
 * Local text state for a session notes field that pushes to the server on a
 * debounce. The remote value is adopted only while no local edit is pending, so
 * a burst of keystrokes isn't clobbered by the echo of an earlier save.
 *
 *   const [notes, editNotes] = useDebouncedNotes(participant.notes ?? "", onNotesChange);
 */
export function useDebouncedNotes(
  remote: string,
  onCommit: (value: string) => void,
  delay = 600,
): [string, (value: string) => void] {
  return useBufferedValue(remote, onCommit, { delay });
}
