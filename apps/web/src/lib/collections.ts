/**
 * Barrel kept for backwards compatibility — the campaign and character data
 * helpers now live in `@/lib/campaigns` and `@/lib/characters`. Prefer importing
 * from those directly in new code.
 */
export type { WithId } from "@adventure-keeper/schemas";

export * from "@/lib/campaigns";
export * from "@/lib/characters";
