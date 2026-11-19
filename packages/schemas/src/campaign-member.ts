import { z } from "zod";
import { auditFieldsSchema } from "./common";

/** A member is either the Game Master or a player. */
export const campaignRoleSchema = z.enum(["gm", "player"]);
export type CampaignRole = z.infer<typeof campaignRoleSchema>;

/** `invited` = invitation sent, not yet accepted; `active` = full member. */
export const campaignMemberStatusSchema = z.enum(["invited", "active"]);
export type CampaignMemberStatus = z.infer<typeof campaignMemberStatusSchema>;

/**
 * `campaigns/{campaignId}/members/{uid}` — per-member data.
 * The document id is the member's Firebase Auth `uid`.
 */
export const campaignMemberSchema = auditFieldsSchema.extend({
  uid: z.string().min(1),
  role: campaignRoleSchema,
  status: campaignMemberStatusSchema.default("active"),
  displayName: z.string().min(1).max(80),
  photoURL: z.string().url().optional(),
  /** Email the invitation was sent to (before the account is linked). */
  invitedEmail: z.string().email().optional(),
  /** Invite this player joined through (`invites/{id}`), checked by the rules. */
  inviteId: z.string().min(1).optional(),
  /**
   * The player's **active** character: the one offered for the next
   * adventures. Always one of `characterIds`.
   */
  characterId: z.string().min(1).optional(),
  /**
   * Every character the player has brought into the campaign — adding one
   * never drops the others. Absent on members written before rosters existed:
   * read it through {@link memberCharacterIds}.
   */
  characterIds: z.array(z.string().min(1)).max(20).optional(),
  /** When the member joined; may differ from `createdAt` for imports. */
  joinedAt: auditFieldsSchema.shape.createdAt.optional(),
});

export type CampaignMember = z.infer<typeof campaignMemberSchema>;

export const campaignMemberCreateSchema = campaignMemberSchema.omit({
  createdAt: true,
  updatedAt: true,
  joinedAt: true,
});

export type CampaignMemberCreate = z.infer<typeof campaignMemberCreateSchema>;

/** The player's roster in the campaign, active character first; legacy docs hold only `characterId`. */
export function memberCharacterIds(
  member: Pick<CampaignMember, "characterId" | "characterIds">,
): string[] {
  const ids = member.characterIds ?? [];
  const active = member.characterId;
  return active ? [active, ...ids.filter((id) => id !== active)] : [...ids];
}
