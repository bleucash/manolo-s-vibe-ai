/**
 * Positions a person can hold, used by two different columns:
 *
 *   profiles.sub_role      person-level identity, self-declared
 *   venue_staff.staff_role relationship-level assignment, manager-set
 *
 * Both stay, because they answer different questions ("what are you" vs
 * "what are you doing at this venue"), and both are constrained to this list.
 *
 * IMPORTANT: the value list is duplicated in the database, as the CHECK
 * constraints `profiles_sub_role_allowed` and `venue_staff_staff_role_allowed`.
 * Adding or removing a position here means editing those too, or writes start
 * failing at the DB. Both are greppable by name.
 *
 * `label` and `description` are display-only and deliberately NOT stored in
 * the database, so copy can change without a migration. Descriptions are
 * stubs; final copy comes later.
 *
 * `guestFacing` is the whole point of this file: operational positions must
 * never surface on Discovery, the talent directory, or public profiles. Every
 * display surface filters on this property rather than keeping its own list,
 * so adding a position is a one-line change here and nowhere else.
 */
interface PositionMeta {
  label: string;
  description: string;
  guestFacing: boolean;
}

export const POSITIONS = {
  host: {
    label: "Host",
    description: "Greets and seats guests, runs the door experience.",
    guestFacing: true,
  },
  entertainer: {
    label: "Entertainer",
    description: "Performs live: dancers, musicians, stage acts.",
    guestFacing: true,
  },
  dj: {
    label: "DJ",
    description: "Runs the music for a room or an event.",
    guestFacing: true,
  },
  bartender: {
    label: "Bartender",
    description: "Works the bar, builds drinks, holds the rail.",
    guestFacing: true,
  },
  bottle_girl: {
    label: "Bottle Girl",
    description: "Runs bottle service to tables and sections.",
    guestFacing: true,
  },
  promoter: {
    label: "Promoter",
    description: "Brings the crowd, drives guest list and turnout.",
    guestFacing: true,
  },
  media: {
    label: "Media",
    description: "Shoots photo and video, produces content for the night.",
    guestFacing: true,
  },
  security: {
    label: "Security",
    description: "Door and floor safety. Operational, never shown to guests.",
    guestFacing: false,
  },
  event_staff: {
    label: "Event Staff",
    description: "Setup, teardown, and run-of-show support. Operational.",
    guestFacing: false,
  },
} as const;

/** Editor-level type safety without a database type to migrate. */
export type Position = keyof typeof POSITIONS;

/** Shape check: fails the build if an entry is missing a field. */
const _shape: Record<Position, PositionMeta> = POSITIONS;
void _shape;

export const ALL_POSITIONS = Object.keys(POSITIONS) as Position[];

/** The only positions any guest-facing surface may render or offer. */
export const GUEST_FACING_POSITIONS = ALL_POSITIONS.filter((p) => POSITIONS[p].guestFacing);

export const isPosition = (value: string | null | undefined): value is Position =>
  !!value && value in POSITIONS;

/**
 * True only for known, guest-facing positions. Unknown values are treated as
 * NOT guest-facing: legacy free text should fail closed rather than leak into
 * a public surface because nobody recognised it.
 */
export const isGuestFacingPosition = (value: string | null | undefined): boolean =>
  isPosition(value) && POSITIONS[value].guestFacing;

/**
 * Display label, falling back to the raw stored value so a row written before
 * this list existed still renders as something rather than vanishing.
 */
export const positionLabel = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return isPosition(value) ? POSITIONS[value].label : value;
};

/**
 * Label for guest-facing surfaces: returns null for operational positions and
 * for anything unrecognised, so callers render their own fallback instead of
 * leaking "SECURITY" onto a public card. Use this on Discovery, the talent
 * directory and public profiles; use positionLabel on internal surfaces like
 * the CEO dashboard, which should see every position.
 */
export const guestFacingLabel = (value: string | null | undefined): string | null =>
  isGuestFacingPosition(value) ? POSITIONS[value as Position].label : null;

/**
 * True only for a KNOWN operational position. Deliberately not the inverse of
 * isGuestFacingPosition: null means "not chosen yet" and unknown means legacy
 * free text, and neither should be dropped from a listing. Use this to filter
 * people out of guest-facing lists; use isGuestFacingPosition to decide
 * whether to render a label.
 */
export const isOperationalPosition = (value: string | null | undefined): boolean =>
  isPosition(value) && !POSITIONS[value].guestFacing;
