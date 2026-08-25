/**
 * Brand-level values that are expected to change before launch.
 *
 * Deliberately its own file rather than inlined at the point of use: these
 * get swapped once the final brand name and accounts are settled, and hunting
 * them across JSX is exactly the kind of thing that gets half-done.
 *
 * Add to this file rather than hardcoding a new one somewhere.
 */

/**
 * Instagram account that talent applicants DM their verification code to.
 * Stored WITHOUT the leading "@" so it composes into both display strings
 * and instagram.com URLs; add the "@" at render time.
 *
 * This is the real brand account, registered and in use. Applicants are told
 * to DM whatever is set here, so changing it changes the instructions talent
 * see. Nothing persists it: the value is read at render time and only the
 * APPLICANT's own handle is ever stored, so a change takes effect everywhere
 * at once and cannot strand an existing record.
 */
export const VERIFICATION_INSTAGRAM_HANDLE = "getmanolo";
