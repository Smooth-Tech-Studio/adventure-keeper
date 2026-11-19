import { z } from "zod";

/** On the session doc: where the room is and how to join it. GM-written. */
export const sessionRealtimeSchema = z.object({
  /** `https://jeu.example.org` (or `http://localhost:8787` in development). */
  url: z.string().url(),
  /** Proves the campaign membership to the server. */
  memberKey: z.string().min(16).max(128),
});
export type SessionRealtime = z.infer<typeof sessionRealtimeSchema>;
