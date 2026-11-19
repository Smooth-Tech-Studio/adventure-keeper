import { z } from "zod";
import { imageCropSchema } from "./character";
import { auditFieldsSchema } from "./common";

/**
 * `users/{uid}` — profile document mirroring a Firebase Auth account.
 * The document id is always the Firebase Auth `uid`.
 */
export const userProfileSchema = auditFieldsSchema.extend({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(2).max(80),
  /** Avatar: a link to an image hosted elsewhere, like a character portrait… */
  photoURL: z.string().url().optional(),
  /** …and the square of it to show. */
  photoCrop: imageCropSchema.optional(),
  /** A few lines for the members of one's campaigns: style of play, availability… */
  bio: z.string().max(500).optional(),
  /** ISO 639-1 language code for the UI, e.g. "fr" or "en". */
  locale: z.string().min(2).max(10).default("fr"),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

/** Payload accepted when creating a profile (server fills the audit fields). */
export const userProfileCreateSchema = userProfileSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type UserProfileCreate = z.infer<typeof userProfileCreateSchema>;

/** Fields a user is allowed to edit on their own profile. */
export const userProfileUpdateSchema = userProfileSchema
  .pick({ displayName: true, photoURL: true, photoCrop: true, bio: true, locale: true })
  .partial();

export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;
