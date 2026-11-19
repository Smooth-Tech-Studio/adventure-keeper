/** The image stores the app can upload to. Dropbox first; others may follow. */
export type StorageProvider = "dropbox";

/**
 * A player's link to their image store, kept in `users/{uid}/private/storage`
 * (readable by its owner alone). The refresh token lets the app get a new
 * access token without asking again.
 */
export interface StorageConnection {
  provider: StorageProvider;
  refreshToken: string;
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  accountName?: string;
  accountEmail?: string;
}
