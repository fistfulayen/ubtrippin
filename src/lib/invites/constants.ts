/**
 * Invite system constants.
 * Centralised here so changes propagate everywhere without hunting magic numbers.
 */

/** Number of invite codes a Pro user gets per week (resets Monday UTC). */
export const INVITE_WEEKLY_LIMIT = 3

/** Number of days an invite code remains valid after creation. */
export const INVITE_EXPIRY_DAYS = 7

/** Minimum invite code length (characters). */
export const INVITE_CODE_MIN_LENGTH = 4

/** Maximum depth of the referral tree query. */
export const REFERRAL_TREE_MAX_DEPTH = 3

/** App base URL — required; falls back to ubtrippin.xyz for safety. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.ubtrippin.xyz'
