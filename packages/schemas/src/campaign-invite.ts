import { z } from "zod";
import { auditFieldsSchema } from "./common";
import { characterSystemSchema } from "./character-system";

/**
 * `link` = a shareable URL anyone signed in can open; `email` = sent to one
 * account, which accepts or declines it from its notifications.
 */
export const campaignInviteKindSchema = z.enum(["link", "email"]);
export type CampaignInviteKind = z.infer<typeof campaignInviteKindSchema>;

/**
 * A link stays `pending` (usable) until the GM revokes it. An email invite is
 * `pending` until the player joins (`accepted`) or declines it.
 */
export const campaignInviteStatusSchema = z.enum(["pending", "accepted", "declined", "revoked"]);
export type CampaignInviteStatus = z.infer<typeof campaignInviteStatusSchema>;

/**
 * `invites/{inviteId}` — top-level so a player who is not a member yet can
 * read it. It carries a snapshot of what the join screen shows (campaign
 * name, GM name, character system) because that player cannot read the
 * campaign itself. The id of a link invite is the secret in its URL.
 */
export const campaignInviteSchema = auditFieldsSchema.extend({
  kind: campaignInviteKindSchema,
  status: campaignInviteStatusSchema.default("pending"),
  campaignId: z.string().min(1),
  campaignName: z.string().min(1).max(120),
  characterSystem: characterSystemSchema,
  gmUid: z.string().min(1),
  gmName: z.string().min(1).max(80),
  /** Email invites only: the invited account. */
  invitedUid: z.string().min(1).optional(),
  /** Email invites only: shown to the GM in the pending list. */
  invitedName: z.string().min(1).max(80).optional(),
  respondedAt: auditFieldsSchema.shape.createdAt.optional(),
});

export type CampaignInvite = z.infer<typeof campaignInviteSchema>;

/** Can this invite still be used to join? */
export function campaignInviteIsOpen(invite: Pick<CampaignInvite, "status">): boolean {
  return invite.status === "pending";
}
