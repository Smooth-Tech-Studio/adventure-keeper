/** Waits between two tries: half a second, then longer — about six seconds in all. */
export const RETRY_DELAYS_MS = [500, 1500, 4000] as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `read` again after each delay while it throws, then once more: its
 * last error is the caller's. For a one-shot read that nothing else would
 * redo — a sheet in the group card — where a passing failure (the connection
 * not up yet) would otherwise stay on screen until a reload.
 */
export async function retrying<T>(
  read: () => Promise<T>,
  delaysMs: readonly number[] = RETRY_DELAYS_MS,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<T> {
  for (const delay of delaysMs) {
    try {
      return await read();
    } catch {
      await wait(delay);
    }
  }
  return read();
}
