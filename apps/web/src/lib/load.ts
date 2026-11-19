/**
 * Wrap a secondary read so its failure (e.g. Firestore rules not yet deployed
 * for one subcollection) is logged and defaulted instead of taking the whole
 * page down.
 */
export function softLoad<T>(label: string, fallback: T) {
  return (error: unknown): T => {
    console.error(`[load] impossible de charger ${label}`, error);
    return fallback;
  };
}
