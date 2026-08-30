/**
 * Three unrelated concepts in this codebase share the word "active". Keeping
 * them apart is the whole reason this file exists:
 *
 *   Affiliation  venue_staff.status = 'active'
 *                Approved to work at this venue. Persists for months.
 *
 *   Tapped in    profiles.is_active + profiles.current_venue_id
 *                Working right now, at this venue. Talent's own toggle.
 *
 *   Open         venues.is_active
 *                Venue is open for business. Manager-flipped, changes daily.
 *
 * Affiliation is a prerequisite for tapping in and is enforced by the
 * profiles_enforce_check_in trigger, but it never implies it. Open is
 * independent of both.
 *
 * PRESENCE, the thing guests should see, needs all three of: the talent is
 * tapped in, they are tapped in HERE, and here is open. Before this file only
 * Index.tsx applied the third condition, so a talent tapped in at a closed
 * venue read as present on their profile, on Discovery, and worst of all in
 * CreatePostDialog, which wrote it into a post's venue tag where it outlived
 * the night entirely.
 *
 * Tapped-in state is deliberately NOT cleared when a venue closes. Open gets
 * flipped routinely, and clearing would silently tap out an entire floor on a
 * manager's toggle. Presence is computed at display time instead, so closing
 * hides it and reopening restores it without destroying anything.
 */

export interface PresenceProfile {
  is_active?: boolean | null;
  current_venue_id?: string | null;
}

export interface PresenceVenue {
  id?: string | null;
  is_active?: boolean | null;
}

/**
 * Tapped in at all, regardless of where or whether that venue is open.
 *
 * Declared as a type predicate rather than `boolean` so the compiler keeps
 * what the check proves: past this guard, `current_venue_id` is a string. It
 * returned plain `boolean` before, which threw that away and left callers
 * writing `profile.current_venue_id!` right after testing it. The guarantee
 * lives in the signature now, so nobody has to assert it.
 */
export const isTappedIn = <T extends PresenceProfile>(
  profile: T | null | undefined,
): profile is T & { current_venue_id: string } => !!profile?.is_active && !!profile?.current_venue_id;

/**
 * The guest-facing question: is this person visibly present at this venue,
 * right now? Requires tapped in, tapped in HERE, and here open.
 *
 * Use this everywhere presence is displayed. TalentDashboard is the one
 * deliberate exception: it is the talent's own view, where "tapped in, venue
 * closed" is more useful than silently showing nothing.
 */
export const isPresentAt = (
  profile: PresenceProfile | null | undefined,
  venue: PresenceVenue | null | undefined,
): boolean => {
  if (!isTappedIn(profile) || !venue?.is_active) return false;
  // A venue with no id cannot be matched against; fail closed rather than
  // treating "unknown venue" as "the right venue".
  if (!venue.id) return false;
  return profile!.current_venue_id === venue.id;
};

/**
 * Same rule where the caller already knows the venue matches and only needs
 * to fold in whether it is open, e.g. a profile that embedded its own venue.
 */
export const isPresentAtOwnVenue = (
  profile: PresenceProfile | null | undefined,
  venueIsOpen: boolean | null | undefined,
): boolean => isTappedIn(profile) && !!venueIsOpen;
