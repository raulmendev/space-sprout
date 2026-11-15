import { DISPLAY_NAME_MAX, SUITS, USER_ROLES, normalizeStationKey } from '@garden/shared';
import { z } from 'zod';

const displayName = z.string().trim().min(1).max(DISPLAY_NAME_MAX);
const role = z.enum(USER_ROLES);
const suit = z.enum(SUITS);
const color = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'must be a #rrggbb colour')
  .transform((c) => c.toLowerCase());

/** The start menu's answers. No station key starts a new station; a key joins that one. */
export const JoinSchema = z.object({
  displayName,
  role,
  suit,
  stationKey: z
    .string()
    .max(32)
    .optional()
    .transform((k) => (k && normalizeStationKey(k)) || undefined),
});
export type JoinInput = z.infer<typeof JoinSchema>;

/** "That's me": a member of the station the key names. */
export const SignInSchema = z.object({
  stationKey: z.string().max(32).transform(normalizeStationKey),
  memberId: z.string().min(1).max(64),
});
export type SignInInput = z.infer<typeof SignInSchema>;

export const MemberChangesSchema = z
  .object({ displayName: displayName.optional(), role: role.optional(), suit: suit.optional(), color: color.optional() })
  .refine((c) => Object.keys(c).length > 0, 'nothing to change');
export type MemberChanges = z.infer<typeof MemberChangesSchema>;
