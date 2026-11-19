import { toast } from "sonner";

/**
 * Fire a side-effecting async action and absorb any rejection: the error is
 * logged, and — when `message` is given — surfaced to the user as a toast. The
 * returned promise always resolves, so callers can leave it unawaited for
 * fire-and-forget mutations or `await` it as a best-effort step.
 *
 *   run(() => updateNote(id, patch), "Enregistrement impossible.");
 *   await run(() => setAdventureLiveSession(c, a, null)); // log-only
 */
export async function run(action: () => Promise<unknown>, message?: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error(error);
    if (message) toast.error(message);
  }
}
